const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

// DOCTOR LOGIN
// DOCTOR LOGIN
router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password
    } = req.body;

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Find doctor
    const doctor = await Doctor.findOne({
      email: {
        $regex: new RegExp(`^${normalizedEmail}$`, 'i')
      }
    });

    if (!doctor) {
      return res.json({
        success: false,
        message: "Doctor not found"
      });
    }

    // Check Active Status - Strict check as per requirements
    // (Assuming schema default is true, checking explicit false or if logic requires strict true)
    if (doctor.isActive === false) {
      return res.json({
        success: false,
        message: "Account not activated"
      });
    }

    // Password Validation
    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password.trim(), doctor.password);
    } catch (e) {
      console.error("Password comparison error:", e);
      // isMatch remains false
    }

    if (!isMatch) {
      return res.json({
        success: false,
        message: "Invalid password"
      });
    }

    // Generate Token
    const token = jwt.sign({
      id: doctor._id,
      role: "doctor"
    }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({
      success: true,
      token,
      user: {
        _id: doctor._id,
        email: doctor.email,
        role: "doctor",
        firstName: doctor.firstName || '',
        lastName: doctor.lastName || ''
      }
    });

  } catch (err) {
    console.error("Doctor Login Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

const auth = require("../middleware/auth");
const Appointment = require("../models/Appointment");

// Patients endpoints for doctor dashboard
// GET /api/doctors/patients -> list of patients derived from appointments
router.get("/patients", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') return res.status(403).json({
      success: false
    });

    // 1. Get all patients
    const patients = await User.find({
      role: "patient"
    }).select("_id firstName lastName email phone age gender isPlaceholderEmail status createdAt");

    // 2. Get all appointments to calculate stats
    const allAppts = await Appointment.find({}).sort({
      date: -1
    });

    const mapped = patients.map(p => {
      const patientAppts = allAppts.filter(a => String(a.patientId) === String(p._id));
      const lastAppt = patientAppts[0]; // Sorted by date desc

      return {
        _id: p._id,
        id: p._id,
        name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
        email: p.email,
        contact: p.phone,
        age: p.age || null,
        gender: p.gender || undefined,
        totalVisits: patientAppts.length,
        lastVisit: lastAppt ? new Date(lastAppt.date).toLocaleDateString() : 'Never',
        since: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'N/A',
        isPlaceholderEmail: p.isPlaceholderEmail || false,
        status: p.status || 'PENDING'
      };
    });

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// GET /api/doctors/patients/:id -> patient detail
router.get("/patients/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const p = await User.findById(id).select("_id firstName lastName email phone age gender medicalHistory isPlaceholderEmail status");
    if (!p) return res.status(404).json({});
    // provide fields expected by frontend: name, email, contact, age?, medicalHistory[]
    res.json({
      _id: p._id,
      id: p._id,
      name: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
      email: p.email,
      contact: p.phone,
      age: p.age || null,
      gender: p.gender || undefined,
      medicalHistory: p.medicalHistory || [],
      isPlaceholderEmail: p.isPlaceholderEmail || false,
      status: p.status || 'PENDING'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

// POST /api/doctors/patients/:id/history -> add a medical history item
router.post("/patients/:id/history", async (req, res) => {
  try {
    const id = req.params.id;
    const {
      notes
    } = req.body;
    if (!notes) return res.status(400).json({
      success: false,
      message: "Notes required"
    });
    // Use update to push history even if field not defined in schema
    await User.updateOne({
      _id: id
    }, {
      $push: {
        medicalHistory: {
          date: new Date(),
          notes
        }
      }
    });
    res.json({
      success: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

module.exports = router;
