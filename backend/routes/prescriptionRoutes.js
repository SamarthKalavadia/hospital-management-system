const express = require('express');
const router = express.Router();
const Prescription = require('../models/Prescription');
const User = require('../models/User');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Medicine = require('../models/Medicine');
const {
  generatePrescriptionPDF
} = require('../utils/pdfGenerator');
const {
  sendPrescriptionEmail
} = require('../utils/emailService');

// list - protected. patients see their own, doctors see all
router.get('/', auth, async (req, res) => {
  try {
    let list;
    if (req.user && req.user.role === 'patient') {
      list = await Prescription.find({
        patientId: req.user.id
      }).sort({
        createdAt: -1
      });
    } else {
      // For doctors, allow filtering by patientId
      const filter = {};
      if (req.query.patientId) {
        filter.patientId = req.query.patientId;
      }
      list = await Prescription.find(filter).sort({
        createdAt: -1
      });
    }
    res.json(list);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false
    });
  }
});

// get one
router.get('/:id', async (req, res) => {
  try {
    const p = await Prescription.findById(req.params.id);
    if (!p) return res.status(404).json({});
    res.json(p);
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

// Helper: Process full PDF delivery flow
async function processPrescriptionDelivery(prescriptionId) {
  const prescription = await Prescription.findById(prescriptionId);
  if (!prescription) throw new Error('Prescription not found');

  const patient = await User.findById(prescription.patientId);
  if (!patient || !patient.email) throw new Error('Patient email missing');

  const doctor = await User.findById(prescription.doctorId);

  // 1. Generate PDF (Server Side)
  const pdfBuffer = await generatePrescriptionPDF({
    patient,
    prescription,
    doctor
  });

  // 2. Save PDF to local storage for patient download
  const fileName = `Prescription_${prescriptionId}.pdf`;
  const uploadDir = path.join(__dirname, '..', 'uploads', 'prescriptions');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, {
    recursive: true
  });

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, pdfBuffer);

  // Update db with path
  prescription.pdfPath = filePath;
  await prescription.save();

  // 3. Email PDF
  await sendPrescriptionEmail({
    patient,
    doctor,
    pdfBuffer
  });

  return true;
}

// Download Prescription (Patient Side)
router.get('/:id/download', auth, async (req, res) => {
  try {
    const p = await Prescription.findById(req.params.id);
    if (!p) return res.status(404).json({
      message: "Prescription not found"
    });

    // Security: Patient can only download their own
    if (req.user.role === 'patient' && String(p.patientId) !== String(req.user.id)) {
      return res.status(403).json({
        message: "Unauthorized access"
      });
    }

    if (!p.pdfPath || !fs.existsSync(p.pdfPath)) {
      return res.status(404).json({
        message: "PDF file not found"
      });
    }

    res.download(p.pdfPath, `Prescription_${new Date(p.createdAt).toLocaleDateString().replace(/\//g, '-')}.pdf`);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Download failed"
    });
  }
});

// create (protected - doctors only)
router.post('/', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      patientId,
      patientName,
      diagnosis,
      medicines,
      appointmentId
    } = req.body;

    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      throw new Error('Medicines array is required');
    }

    const medicinesData = [];
    for (const m of medicines) {
      const name = m.name || m.medicineName;
      const qtyPrescribed = Number(m.qty || m.quantity);

      if (!qtyPrescribed || qtyPrescribed <= 0) {
        throw new Error(`Invalid quantity for ${name || 'unknown medicine'}`);
      }

      const medInStock = await Medicine.findOne({
        name: {
          $regex: new RegExp(`^${name.trim()}$`, "i")
        }
      }).session(session);

      if (!medInStock) {
        throw new Error(`Medicine "${name}" not found`);
      }

      if (medInStock.quantity < qtyPrescribed) {
        throw new Error(`Insufficient stock for this medicine: ${name}`);
      }

      medicinesData.push({
        medicineId: medInStock._id,
        medicineName: medInStock.name,
        dosage: m.dosage || m.dose || undefined,
        duration: m.duration || 0,
        instructions: m.instructions || "",
        qty: qtyPrescribed
      });
    }

    const prescription = new Prescription({
      patientId: patientId || undefined,
      patientName: patientName || undefined,
      doctorId: req.user.id,
      appointmentId: appointmentId || undefined,
      diagnosis: diagnosis || undefined,
      medicines: medicinesData
    });

    await prescription.save({
      session
    });

    // Atomic Stock Update with Race Condition Prevention
    for (const med of medicinesData) {
      const updatedMed = await Medicine.findOneAndUpdate({
        _id: med.medicineId,
        quantity: {
          $gte: med.qty
        }
      }, {
        $inc: {
          quantity: -Math.abs(med.qty)
        }
      }, {
        new: true,
        session
      });

      if (!updatedMed) {
        throw new Error(`Stock conflict/insufficient units for ${med.medicineName}. Please try again.`);
      }
    }

    await session.commitTransaction();
    session.endSession();

    // AUTO-DELIVERY (Silent Background Task)
    processPrescriptionDelivery(prescription._id).catch(e => console.error("Auto-delivery failed:", e));

    res.json({
      success: true,
      prescription,
      message: "Prescription created and sent to patient successfully"
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Prescription Save Error:', err.message);
    res.status(400).json({
      success: false,
      message: err.message || 'Server error'
    });
  }
});

// Update Prescription (PUT)
router.put('/:id', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      diagnosis,
      medicines
    } = req.body;
    const oldPrescription = await Prescription.findById(req.params.id).session(session);
    if (!oldPrescription) throw new Error('Prescription not found');

    // 1. Revert Old Stock
    for (const m of oldPrescription.medicines) {
      await Medicine.findOneAndUpdate({
        _id: m.medicineId
      }, {
        $inc: {
          quantity: m.qty
        }
      }).session(session);
    }

    // 2. Prepare New Data & Deduct New Stock
    const newMedicinesData = [];
    for (const m of (medicines || [])) {
      const name = m.name || m.medicineName;
      const qtyPrescribed = Number(m.qty || m.quantity);

      if (!qtyPrescribed || qtyPrescribed <= 0) throw new Error(`Invalid quantity for ${name}`);

      const medInStock = await Medicine.findOne({
        name: {
          $regex: new RegExp(`^${name.trim()}$`, "i")
        }
      }).session(session);

      if (!medInStock) throw new Error(`Medicine "${name}" not found`);
      if (medInStock.quantity < qtyPrescribed) throw new Error(`Insufficient stock for: ${name}`);

      await Medicine.findOneAndUpdate({
        _id: medInStock._id
      }, {
        $inc: {
          quantity: -qtyPrescribed
        }
      }).session(session);

      newMedicinesData.push({
        medicineId: medInStock._id,
        medicineName: medInStock.name,
        dosage: m.dosage || m.dose || undefined,
        duration: m.duration || 0,
        instructions: m.instructions || "",
        qty: qtyPrescribed
      });
    }

    // 3. Update Prescription
    oldPrescription.diagnosis = diagnosis || oldPrescription.diagnosis;
    oldPrescription.medicines = newMedicinesData;
    await oldPrescription.save({
      session
    });

    await session.commitTransaction();
    session.endSession();

    // Re-trigger auto delivery on update
    processPrescriptionDelivery(oldPrescription._id).catch(e => console.error("Update-delivery failed:", e));

    res.json({
      success: true,
      prescription: oldPrescription,
      message: "Prescription updated and sent successfully"
    });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('Update Error:', err.message);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// Manual Resend Trigger (Backend Generated - Non-blocking)
router.post('/send-pdf', auth, async (req, res) => {
  try {
    const {
      prescriptionId
    } = req.body;
    if (!prescriptionId) return res.status(400).json({
      success: false,
      message: 'Missing prescriptionId'
    });

    // Respond immediately and process in background
    res.json({
      success: true,
      message: 'Processing: Prescription is being sent to patient'
    });

    setImmediate(() => {
      processPrescriptionDelivery(prescriptionId).catch(err => {
        console.error('Background PDF Send Error:', err);
      });
    });

  } catch (err) {
    console.error('PDF Trigger Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to start email process'
    });
  }
});

// Patient Feedback on Recovery (Symptom Progress)
router.post('/:id/feedback', auth, async (req, res) => {
  if (!req.user || req.user.role !== 'patient') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }

  try {
    const { status, comments, aiSummary, conditionName } = req.body;
    const p = await Prescription.findById(req.params.id);
    
    if (!p) return res.status(404).json({ success: false, message: 'Prescription not found' });
    if (String(p.patientId) !== String(req.user.id)) return res.status(403).json({ success: false, message: 'Unauthorized' });

    p.progressFeedback = {
      status,
      conditionName,
      comments,
      aiSummary,
      updatedAt: new Date()
    };

    await p.save();
    res.json({ success: true, message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
