const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const auth = require("../middleware/auth");
const nodemailer = require("nodemailer");

// Email Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 1️⃣ Doctor: Fetch Appointments
// GET /api/doctor/appointments?date=YYYY-MM-DD
router.get("/", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }

    const {
      date
    } = req.query;
    let query = {
      status: {
        $ne: 'Cancelled'
      }
    };

    if (date) {
      // Match the selected date OR any Pending appointment (Critical Fix)
      const start = new Date(date + "T00:00:00.000Z");
      const end = new Date(date + "T23:59:59.999Z");

      query = {
        status: {
          $ne: 'Cancelled'
        },
        $or: [{
            date: {
              $gte: start,
              $lte: end
            }
          },
          {
            status: {
              $regex: /^pending$/i
            }
          } // Case-insensitive Pending check
        ]
      };
    } else {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      query.date = {
        $gte: now
      };
    }

    const appts = await Appointment.find(query).sort({
      date: 1,
      timeValue: 1
    });

    const now = new Date();
    const mapped = [];

    for (const a of appts) {
      // Standardize Status
      let status = 'Pending';
      if (a.status) {
        const s = a.status.toLowerCase();
        if (s === 'approved' || s === 'confirmed') status = 'Approved';
        else if (s === 'rejected') status = 'Rejected';
        else if (s === 'completed') status = 'Completed';
        else if (s === 'cancelled') status = 'Cancelled';
        else status = 'Pending';
      }

      // AUTO-COMPLETE Logic (Time Gone)
      if (status === 'Approved' || status === 'Pending') {
        const apptDate = new Date(a.date);
        const apptDateTime = new Date(apptDate);
        if (a.time) {
          const parts = a.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (parts) {
            let h = parseInt(parts[1]), m = parseInt(parts[2]), ampm = (parts[3] || '').toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            apptDateTime.setHours(h, m, 0, 0);
          } else {
            apptDateTime.setHours(23, 59, 59);
          }
        } else {
          apptDateTime.setHours(23, 59, 59);
        }

        // Buffer: 30 minutes past the start time
        if (apptDateTime.getTime() < (now.getTime() - 30 * 60 * 1000)) {
          status = 'Completed';
          // Async update DB without awaiting to keep request fast
          Appointment.findByIdAndUpdate(a._id, { status: 'Completed' }).catch(e => console.error("Auto-complete update failed:", e));
        }
      }

      mapped.push({
        _id: a._id,
        patientId: a.patientId,
        patientName: a.patientName,
        patientPhone: a.patientPhone,
        date: a.date,
        time: a.time,
        status: status,
        createdAt: a.createdAt
      });
    }

    // Sort by status priority: Pending → Approved → Completed → Rejected/Cancelled
    const statusOrder = {
      'Pending': 0,
      'Approved': 1,
      'Confirmed': 1,
      'Completed': 2,
      'Rejected': 3,
      'Cancelled': 4
    };
    mapped.sort((a, b) => {
      const orderA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 99;
      const orderB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 99;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.date) - new Date(b.date);
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

// 2️⃣ Doctor: Approve Appointment
// PATCH /api/doctor/appointments/:id/approve
router.patch("/:id/approve", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({
      success: false,
      message: "Not found"
    });

    // Check if already processed
    const currentStatus = (appt.status || '').toLowerCase();
    if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
      return res.status(400).json({
        success: false,
        message: "Cannot approve cancelled or rejected appointment"
      });
    }

    appt.status = 'Approved';
    appt.approvedByDoctorAt = new Date();
    await appt.save();

    // 📩 Send Email Notification (Async-safe)
    const user = await User.findById(appt.patientId);
    if (user && user.email) {
      const emailSubject = "Appointment Approved – Samyak Ayurvedic Hospital";
      const emailHtml = `
            <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:12px; overflow:hidden">
              <div style="background:#155c3b; padding:24px; text-align:center">
                <h2 style="color:#ffffff; margin:0">Appointment Approved</h2>
              </div>
              <div style="padding:32px; color:#333; line-height:1.6">
                <p>Dear <strong>${user.firstName || 'Patient'}</strong>,</p>
                <p>Your appointment at <strong>Samyak Ayurvedic Hospital</strong> has been successfully approved.</p>
                <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0">
                  <p style="margin:4px 0"><strong>📅 Date:</strong> ${new Date(appt.date).toLocaleDateString()}</p>
                  <p style="margin:4px 0"><strong>⏰ Time:</strong> ${appt.time}</p>
                  <p style="margin:4px 0"><strong>👨‍⚕️ Doctor:</strong> Dr. Rajan Karangiya</p>
                  <p style="margin:4px 0"><strong>🏥 Clinic:</strong> Samyak Ayurvedic Hospital</p>
                </div>
                <p>Please arrive 10 minutes prior to your scheduled time.</p>
                <p style="margin-top:24px">Warm Regards,<br><strong>Samyak Ayurvedic Hospital Team</strong></p>
              </div>
              <div style="background:#f1f1f1; padding:16px; text-align:center; font-size:12px; color:#666">
                Address: 39/2/03/2, Lmctrc Nagar, Moti Palace Township, Junagadh, Gujarat 362015
              </div>
            </div>`;

      // Email to Patient (async-safe)
      try {
        await transporter.sendMail({
          from: `Samyak Ayurvedic Hospital <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log("Approval email sent to patient:", user.email);
      } catch (emailErr) {
        console.error("Patient Email Error:", emailErr);
      }

      // Email to Doctor (confirmation copy - async-safe)
      const doctorEmail = process.env.DOCTOR_EMAIL || process.env.EMAIL_USER;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: doctorEmail,
          subject: `[DOCTOR COPY] ${emailSubject}`,
          html: `<p>FYI: You have approved an appointment for <strong>${appt.patientName || user.firstName || 'Patient'}</strong>.</p><br>${emailHtml}`
        });
        console.log("Approval copy sent to doctor");
      } catch (emailErr) {
        console.error("Doctor Email Error:", emailErr);
      }
    }

    res.json({
      success: true,
      appointment: appt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// 3️⃣ Doctor: Reject Appointment
// PATCH /api/doctor/appointments/:id/reject
router.patch("/:id/reject", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: "Forbidden"
      });
    }

    const {
      reason
    } = req.body;
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({
      success: false,
      message: "Not found"
    });

    appt.status = 'Rejected';
    appt.rejectedByDoctorAt = new Date();
    if (reason) appt.reason = reason;
    await appt.save();

    // 📩 Send Email Notification (Async-safe)
    const user = await User.findById(appt.patientId);
    if (user && user.email) {
      const emailSubject = "Appointment Rejected – Samyak Ayurvedic Hospital";
      const emailHtml = `
            <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:12px; overflow:hidden">
              <div style="background:#b71c1c; padding:24px; text-align:center">
                <h2 style="color:#ffffff; margin:0">Appointment Rejected</h2>
              </div>
              <div style="padding:32px; color:#333; line-height:1.6">
                <p>Dear <strong>${user.firstName || 'Patient'}</strong>,</p>
                <p>We regret to inform you that your appointment request has been declined.</p>
                <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0">
                  <p style="margin:4px 0"><strong>📅 Date:</strong> ${new Date(appt.date).toLocaleDateString()}</p>
                  <p style="margin:4px 0"><strong>⏰ Time:</strong> ${appt.time}</p>
                  <p style="margin:4px 0"><strong>👨‍⚕️ Doctor:</strong> Dr. Rajan Karangiya</p>
                  <p style="margin:4px 0"><strong>🏥 Clinic:</strong> Samyak Ayurvedic Hospital</p>
                </div>
                <div style="background:#fff3f3; border-left:4px solid #b71c1c; padding:16px; margin:20px 0">
                  <p style="margin:0; color:#b71c1c"><strong>Reason:</strong> ${reason || 'Schedule conflicts or doctor unavailability'}</p>
                </div>
                <p>Please feel free to book another time slot through your dashboard.</p>
                <p style="margin-top:24px">Warm Regards,<br><strong>Samyak Ayurvedic Hospital Team</strong></p>
              </div>
              <div style="background:#f1f1f1; padding:16px; text-align:center; font-size:12px; color:#666">
                Address: 39/2/03/2, Lmctrc Nagar, Moti Palace Township, Junagadh, Gujarat 362015
              </div>
            </div>`;

      // Email to Patient (async-safe)
      try {
        await transporter.sendMail({
          from: `Samyak Ayurvedic Hospital <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log("Rejection email sent to patient:", user.email);
      } catch (emailErr) {
        console.error("Patient Email Error:", emailErr);
      }

      // Email to Doctor (confirmation copy - async-safe)
      const doctorEmail = process.env.DOCTOR_EMAIL || process.env.EMAIL_USER;
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: doctorEmail,
          subject: `[DOCTOR COPY] ${emailSubject}`,
          html: `<p>FYI: You have rejected an appointment for <strong>${appt.patientName || user.firstName || 'Patient'}</strong>.</p><br>${emailHtml}`
        });
        console.log("Rejection copy sent to doctor");
      } catch (emailErr) {
        console.error("Doctor Email Error:", emailErr);
      }
    }

    res.json({
      success: true,
      appointment: appt
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
