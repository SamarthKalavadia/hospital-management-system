const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const auth = require("../middleware/auth");
const jwt = require("jsonwebtoken");

// Email Configuration
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// GET /api/appointments/slots?date=YYYY-MM-DD - Get booked slots for a date
// GET /api/appointments/slots?date=YYYY-MM-DD
router.get("/slots", auth, async (req, res) => {
  try {
    const {
      date
    } = req.query;
    if (!date) return res.status(400).json({
      success: false,
      message: "Date required"
    });

    // Define all possible slots (Standardizing on backend)
    const ALL_SLOTS = [{
        time: "09:00 AM",
        timeValue: "09:00"
      },
      {
        time: "10:00 AM",
        timeValue: "10:00"
      },
      {
        time: "11:00 AM",
        timeValue: "11:00"
      },
      {
        time: "12:00 PM",
        timeValue: "12:00"
      },
      {
        time: "02:00 PM",
        timeValue: "14:00"
      },
      {
        time: "03:00 PM",
        timeValue: "15:00"
      },
      {
        time: "04:00 PM",
        timeValue: "16:00"
      },
      {
        time: "05:00 PM",
        timeValue: "17:00"
      }
    ];

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Find booked appointments for this date
    const appointments = await Appointment.find({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      status: {
        $nin: ['Cancelled', 'Rejected']
      }
    }).select('timeValue');

    const bookedValues = new Set(appointments.map(a => a.timeValue));

    // Map all slots to response format
    const responseSlots = ALL_SLOTS.map(slot => ({
      time: slot.time,
      timeValue: slot.timeValue,
      isBooked: bookedValues.has(slot.timeValue)
    }));

    res.json(responseSlots);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// POST /api/appointments - Book a new appointment
router.post("/", auth, async (req, res) => {
  try {
    const {
      date,
      time,
      patientId,
      status
    } = req.body; // time is "HH:mm" from frontend (timeValue)
    if (!date || !time) {
      return res.status(400).json({
        success: false,
        message: "Date and Time are required"
      });
    }

    // Check if Sunday
    const day = new Date(date).getDay();
    if (day === 0) {
      return res.status(400).json({
        success: false,
        message: "Hospital is closed on Sundays"
      });
    }

    // Determine patient - doctors can book for other patients
    let targetPatientId = req.user.id;
    let targetUser = await User.findById(req.user.id);

    // If doctor is booking for a specific patient
    if (req.user.role === 'doctor' && patientId) {
      targetPatientId = patientId;
      const patientUser = await User.findById(patientId);
      if (patientUser) {
        targetUser = patientUser;
      }
    }

    if (!targetUser) return res.status(404).json({
      success: false,
      message: "User not found"
    });

    // Format time for display (e.g. "09:00" -> "09:00 AM")
    let formattedTime = time;
    try {
      const [h, m] = time.split(':');
      const H = parseInt(h);
      const ampm = H >= 12 ? 'PM' : 'AM';
      let h12 = H % 12 || 12;
      if (h12 < 10) h12 = '0' + h12; // Ensure leading zero if desired, user said "09:00 AM"
      formattedTime = `${h12}:${m} ${ampm}`;
    } catch (e) {
      // Fallback
      formattedTime = time;
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check for double booking using timeValue
    const existingAppt = await Appointment.findOne({
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      timeValue: time, // Check exact slot value
      status: {
        $ne: 'Cancelled'
      }
    });

    if (existingAppt) {
      return res.status(409).json({
        success: false,
        message: "This slot is already booked"
      });
    }

    // Determine status - doctors can pre-approve, patients get Pending
    let appointmentStatus = 'Pending';
    if (req.user.role === 'doctor' && status) {
      // Normalize status to proper case
      const statusLower = status.toLowerCase();
      if (statusLower === 'approved' || statusLower === 'confirmed') {
        appointmentStatus = 'Approved';
      } else if (statusLower === 'pending') {
        appointmentStatus = 'Pending';
      }
    }

    // Create Appointment
    const newAppt = new Appointment({
      patientId: targetPatientId,
      patientName: `${targetUser.firstName} ${targetUser.lastName}`.trim() || targetUser.email,
      patientPhone: targetUser.phone || '',
      date: new Date(date),
      time: formattedTime, // Save "09:00 AM"
      timeValue: time, // Save "09:00"
      status: appointmentStatus,
      approvedByDoctorAt: appointmentStatus === 'Approved' ? new Date() : undefined,
      doctorId: "000000000000000000000000",
      createdAt: new Date()
    });

    await newAppt.save();

    // ------------------------------------------
    // SEND CONFIRMATION EMAIL (Silent Failure)
    // ------------------------------------------
    if (targetUser.email) {
      const statusMessage = appointmentStatus === 'Approved' ?
        'Your appointment has been scheduled and approved by the doctor.' :
        'Your appointment has been successfully booked and is awaiting approval.';

      const emailSubject = appointmentStatus === 'Approved' ?
        'Appointment Scheduled – Samyak Ayurvedic Hospital' :
        'Appointment Confirmation – Samyak Ayurvedic Hospital';

      const mailOptions = {
        from: `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
        to: targetUser.email,
        subject: emailSubject,
        html: `
          <div style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            
            <div style="background-color: #155c3b; color: #fff; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">Appointment ${appointmentStatus === 'Approved' ? 'Scheduled' : 'Confirmation'}</h2>
            </div>
            
            <div style="padding: 30px;">
              <p style="font-size: 16px; margin: 0 0 20px 0;">Dear <strong>${targetUser.firstName || 'Patient'}</strong>,</p>
              
              <p style="font-size: 16px; margin: 0 0 25px 0; line-height: 1.5;">${statusMessage}</p>
              
              <div style="background-color: #f9fbf9; border: 1px solid #e0e0e0; padding: 20px; margin-bottom: 25px; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0; color: #155c3b; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 8px;">Appointment Details</h3>
                <div style="font-size: 15px;">
                  <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
                  <p style="margin: 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
                  <p style="margin: 8px 0;"><strong>Status:</strong> ${appointmentStatus}</p>
                </div>
              </div>

              <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                <p style="font-size: 15px; color: #333; margin: 0 0 10px 0;">Our team will contact you if any changes are required.</p>
                <p style="font-size: 15px; margin: 0 0 5px 0;">Wishing you good health,</p>
                <p style="font-size: 16px; font-weight: bold; color: #155c3b; margin: 0 0 20px 0;">Samyak Ayurvedic Hospital</p>
                
                <div style="font-size: 13px; color: #666; bg-color: #f5f5f5; padding: 15px; border-radius: 6px;">
                  39/2/03/2, Lmctrc Nagar,<br>
                  Moti Palace Township,<br>
                  Junagadh, Gujarat 362015
                </div>
              </div>
            </div>
          </div>
        `
      };

      // Send asynchronously - do not await
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) console.error("Patient Email Failed:", err.message);
        else console.log("Confirmation Email Sent:", info.response);
      });
    }

    // ------------------------------------------
    // ALERT DOCTOR (Interactive Email Notification)
    // ------------------------------------------
    const leadDoctor = await User.findOne({
      role: 'doctor'
    });
    const doctorEmail = process.env.DOCTOR_EMAIL || leadDoctor?.email || process.env.EMAIL_USER;

    if (appointmentStatus === 'Pending' && doctorEmail) {
      // Generate a Secure Token for this specific action
      const actionToken = jwt.sign({
          appointmentId: newAppt._id,
          doctorId: leadDoctor?._id || "000",
          action: "process"
        },
        process.env.JWT_SECRET, {
          expiresIn: "7d"
        }
      );

      const serverUrl = `${req.protocol}://${req.get('host')}`;
      const approveLink = `${serverUrl}/api/appointments/action/approve?id=${newAppt._id}&token=${actionToken}`;
      const rejectLink = `${serverUrl}/api/appointments/action/reject?id=${newAppt._id}&token=${actionToken}`;

      const doctorMailOptions = {
        from: `"Samyak Hospital Alert" <${process.env.EMAIL_USER}>`,
        to: doctorEmail,
        subject: `[ACTION REQUIRED] Appointment Approval Needed`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eef4f1; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <!-- Green Clinical Header -->
            <div style="background-color: #155c3b; color: #fff; padding: 28px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">Appointment Approval Required</h2>
            </div>
            
            <div style="padding: 35px; background-color: #ffffff;">
              <p style="font-size: 16px; margin: 0 0 20px 0;">Hello <strong>Dr. ${leadDoctor?.firstName || 'Rajan'}</strong>,</p>
              <p style="font-size: 15px; line-height: 1.6; color: #4f6f60; margin: 0 0 25px 0;">A new patient booking requires your review. Please confirm or decline the following slot:</p>
              
              <!-- Patient Card -->
              <div style="background-color: #f3f8f5; border: 1px solid #e8f5e9; padding: 24px; margin-bottom: 30px; border-radius: 10px;">
                <h3 style="margin: 0 0 15px 0; color: #155c3b; font-size: 17px; border-bottom: 2px solid #e8f5e9; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Request Details</h3>
                <div style="font-size: 15px; color: #2c3e50;">
                  <p style="margin: 10px 0;"><strong>👤 Patient:</strong> ${newAppt.patientName}</p>
                  <p style="margin: 10px 0;"><strong>📅 Date:</strong> ${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  <p style="margin: 10px 0;"><strong>⏰ Time Slot:</strong> ${formattedTime}</p>
                  <p style="margin: 10px 0;"><strong>🏥 Status:</strong> <span style="background:#fff8e1; color:#f57f17; padding:2px 8px; border-radius:4px; font-size:13px; font-weight:700;">PENDING APPROVAL</span></p>
                </div>
              </div>

              <!-- Interactive Action Buttons -->
              <div style="display: flex; gap: 15px; margin-bottom: 25px;">
                <a href="${approveLink}" style="flex: 1; text-align: center; background-color: #155c3b; color: #ffffff; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">✅ Approve Appointment</a>
                <a href="${rejectLink}" style="flex: 1; text-align: center; background-color: #fff; color: #b71c1c; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; border: 2px solid #b71c1c; display: inline-block;">❌ Reject Appointment</a>
              </div>

              <div style="padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 13px; color: #6b8a7a; line-height: 1.5;">
                <p style="margin-bottom: 10px;"><strong>Note:</strong> These links are secure and valid for 7 days. Once actioned, they cannot be reused.</p>
                <p>If buttons don’t work, you can also approve or reject from the <a href="${process.env.FRONTEND_URL || '#'}" style="color:#155c3b; font-weight:600;">Doctor Dashboard</a>.</p>
              </div>
            </div>

            <div style="background-color: #f8fbf9; padding: 15px; text-align: center; font-size: 12px; color: #9aa;">
              Samyak Ayurvedic Hospital Automated Clinical System
            </div>
          </div>
        `
      };

      transporter.sendMail(doctorMailOptions, (err) => {
        if (err) console.error("Interactive Doctor Alert Failed:", err.message);
        else console.log("Interactive Doctor Alert Email Sent to:", doctorEmail);
      });
    }

    res.json({
      success: true,
      message: "Appointment booked successfully",
      appointment: newAppt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
});

// GET /api/appointments/doctor?date=YYYY-MM-DD - appointments for authenticated doctor
router.get("/doctor", auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') return res.status(403).json({
      success: false,
      message: 'Forbidden'
    });

    const doctorId = req.user.id;
    const dateStr = req.query.date;
    let start, end;
    if (dateStr) {
      start = new Date(dateStr);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    } else {
      start = new Date();
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
    }

    const appts = await Appointment.find({
      doctorId,
      date: {
        $gte: start,
        $lt: end
      }
    }).sort({
      date: 1
    });
    const mapped = appts.map(a => ({
      id: a._id,
      patient: a.patientName || '',
      patientId: a.patientId || null,
      patientPhone: a.patientPhone || '',
      date: a.date,
      time: a.date ? new Date(a.date).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
      }) : '',
      reason: a.reason || '',
      status: a.status || 'Pending'
    }));

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET /api/appointments/patient - appointments for authenticated patient
router.get("/patient", auth, async (req, res) => {
  try {
    // 1. Verify role
    if (!req.user || req.user.role !== 'patient') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Access restricted to patients.'
      });
    }

    // 2. Fetch appointments for this patient
    // We assume patientId is stored in the appointment document
    const patientId = req.user.id;
    const appts = await Appointment.find({
      patientId
    }).sort({
      date: -1
    }); // Sort newest first

    // 3. Map to required structure
    const now = new Date();
    const data = [];

    for (const a of appts) {
      const d = new Date(a.date);
      let status = a.status || 'Pending';

      // AUTO-COMPLETE Logic (Time Gone)
      if (status === 'Approved' || status === 'Pending' || status === 'Confirmed') {
        const apptDateTime = new Date(d);
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

        if (apptDateTime.getTime() < (now.getTime() - 30 * 60 * 1000)) {
          status = 'Completed';
          Appointment.findByIdAndUpdate(a._id, { status: 'Completed' }).catch(e => console.error("Auto-complete patient update failed:", e));
        }
      }

      data.push({
        _id: a._id,
        date: d.toLocaleDateString(),
        rawDate: a.date,
        time: a.time || '--',
        status: status,
        createdAt: a.createdAt
      });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET /api/appointments/history - History (Completed, Cancelled, Rejected)
router.get("/history", auth, async (req, res) => {
  try {
    const patientId = req.user.id;
    const history = await Appointment.find({
      patientId,
      status: {
        $in: ['Completed', 'Cancelled', 'Rejected']
      }
    }).sort({
      date: -1
    });

    // Map to required format
    const data = history.map(a => {
      const d = new Date(a.date);
      return {
        _id: a._id,
        date: d.toLocaleDateString(),
        time: a.time || '--',
        status: a.status
      };
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* GET APPOINTMENTS for a user (protected) */
router.get("/:userId", auth, async (req, res) => {
  try {
    const {
      userId
    } = req.params;
    // If a patient requests, ensure they only fetch their own data
    if (req.user && req.user.role === 'patient' && String(req.user.id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    // Prefer patientId field, fall back to patientName matching when unavailable
    const appointments = await Appointment.find({
      $or: [{
          patientId: userId
        },
        {
          patientPhone: userId
        },
        {
          patientName: {
            $regex: new RegExp(userId, 'i')
          }
        }
      ]
    }).sort({
      date: 1
    });

    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// DELETE /api/appointments/:id - Cancel Appointment (Soft Delete)
router.delete("/:id", auth, async (req, res) => {
  try {
    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({
      success: false,
      message: "Appointment not found"
    });

    // Check ownership
    if (req.user.role === 'patient' && String(appt.patientId) !== String(req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Check if past
    const apptDateTime = new Date(appt.date);
    // Try to refine time if available (appt.timeValue is "HH:mm")
    if (appt.timeValue) {
      const [h, m] = appt.timeValue.split(':');
      apptDateTime.setHours(parseInt(h), parseInt(m));
    } else if (appt.time && appt.time.includes(':')) {
      // Best effort parse "09:00 AM" if timeValue missing
      const parts = appt.time.split(/[:\s]/); // ["09", "00", "AM"]
      let h = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const ampm = parts[2] ? parts[2].toUpperCase() : '';
      if (ampm === 'PM' && h < 12) h += 12;
      if (amppm === 'AM' && h === 12) h = 0;
      apptDateTime.setHours(h, m);
    }

    const now = new Date();
    const diffInHours = (apptDateTime - now) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return res.status(400).json({
        success: false,
        message: "You cannot cancel within 24 hours of the appointment."
      });
    }

    if (apptDateTime < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel past appointments"
      });
    }

    // Soft Delete
    appt.status = 'Cancelled';
    await appt.save();

    // ----------------------------------------------------
    // SEND EMAILS (Async-safe)
    // ----------------------------------------------------
    const user = await User.findById(appt.patientId);
    if (user && user.email) {
      const emailSubject = "Appointment Cancelled – Samyak Ayurvedic Hospital";
      const emailHtml = `
      <div style="font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width:600px; margin:auto; border:1px solid #e0e0e0; border-radius:12px; overflow:hidden">
        <div style="background:#b71c1c; padding:24px; text-align:center">
          <h2 style="color:#ffffff; margin:0">Appointment Cancelled</h2>
        </div>
        <div style="padding:32px; color:#333; line-height:1.6">
          <p>Dear <strong>${user.firstName || user.name || 'Patient'}</strong>,</p>
          <p>Your appointment scheduled on <strong>${new Date(appt.date).toLocaleDateString()}</strong> at <strong>${appt.time}</strong> has been cancelled.</p>
          <div style="background:#ffebee; border: 1px solid #ffcdd2; padding: 20px; margin: 25px 0; border-radius: 8px;">
            <h3 style="margin: 0 0 15px 0; color: #b71c1c; font-size: 18px; border-bottom: 1px solid #ffcdd2; padding-bottom: 8px;">Cancelled Details</h3>
            <div style="font-size: 15px;">
              <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date(appt.date).toLocaleDateString()}</p>
              <p style="margin: 8px 0;"><strong>Time:</strong> ${appt.time}</p>
            </div>
          </div>
          <p>You can book a new appointment anytime through your patient dashboard.</p>
          <p style="margin-top:24px">Warm Regards,<br><strong>Samyak Ayurvedic Hospital Team</strong></p>
        </div>
        <div style="background:#f1f1f1; padding:16px; text-align:center; font-size:12px; color:#666">
          Address: 39/2/03/2, Lmctrc Nagar, Moti Palace Township, Junagadh, Gujarat 362015
        </div>
      </div>`;

      // Email to Patient
      try {
        await transporter.sendMail({
          from: `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log("Cancellation email sent to patient:", user.email);
      } catch (emailErr) {
        console.error("Email Error:", emailErr);
      }

      // Email to Doctor (Copy)
      try {
        const doctorEmail = process.env.DOCTOR_EMAIL || process.env.EMAIL_USER;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: doctorEmail,
          subject: `[DOCTOR ALERT] Appointment Cancelled`,
          html: `<p>Patient <strong>${user.firstName || 'Unknown'}</strong> has cancelled their appointment on ${new Date(appt.date).toLocaleDateString()} at ${appt.time}.</p>`
        });
      } catch (emailErr) {
        console.error("Doctor copy email error:", emailErr);
      }
    }

    res.json({
      success: true,
      message: "Appointment cancelled"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// PUT /api/appointments/:id/reschedule - Reschedule
router.put("/:id/reschedule", auth, async (req, res) => {
  try {
    const {
      date,
      time
    } = req.body;
    if (!date || !time) return res.status(400).json({
      success: false,
      message: "New date and time required"
    });

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({
      success: false,
      message: "Not found"
    });

    if (appt.patientId.toString() !== req.user.id && req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    // Format new time
    let formattedTime = time;
    try {
      const [h, m] = time.split(':');
      const H = parseInt(h);
      const ampm = H >= 12 ? 'PM' : 'AM';
      let h12 = H % 12 || 12;
      if (h12 < 10) h12 = '0' + h12;
      formattedTime = `${h12}:${m} ${ampm}`;
    } catch (e) {}

    // Atomic update data
    appt.date = new Date(date);
    appt.time = formattedTime;
    appt.timeValue = time;
    appt.status = 'Pending'; // Reset to pending for doctor re-approval
    await appt.save();

    // 📩 Send Reschedule Notification (Silent Failure)
    try {
      const user = await User.findById(appt.patientId);
      if (user && user.email) {
        const mailOptions = {
          from: `"Samyak Hospital" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Appointment Rescheduled – Samyak Ayurvedic Hospital",
          html: `
            <div style="font-family: sans-serif; padding: 20px; border: 1px solid #d9edf7; border-radius: 8px;">
              <h2 style="color: #31708f;">Appointment Rescheduled</h2>
              <p>Hi ${user.firstName},</p>
              <p>Your appointment has been successfully moved to <strong>${new Date(date).toLocaleDateString()}</strong> at <strong>${formattedTime}</strong>.</p>
              <p>Status: <strong>Awaiting Approval</strong></p>
              <p style="margin-top: 30px; font-size: 13px; color: #888;">Samyak Ayurvedic Hospital</p>
            </div>`
        };
        transporter.sendMail(mailOptions);
      }
    } catch (e) {}

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


// Doctor API - Approve Appointment
router.patch("/:id/approve", auth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') return res.status(403).json({
      success: false,
      message: "Forbidden"
    });

    const appt = await Appointment.findById(req.params.id);
    if (!appt) return res.status(404).json({
      success: false,
      message: "Not found"
    });

    appt.status = 'Approved';
    appt.approvedByDoctorAt = new Date();
    await appt.save();

    // 📩 Professional HTML Email for Approval (Async-safe)
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

      try {
        await transporter.sendMail({
          from: `Samyak Ayurvedic Hospital <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log("Approval email sent to patient:", user.email);
      } catch (emailErr) {
        console.error("Email Error:", emailErr);
      }

      // Email to Doctor (confirmation copy)
      try {
        const doctorEmail = process.env.DOCTOR_EMAIL || process.env.EMAIL_USER;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: doctorEmail,
          subject: `[DOCTOR COPY] ${emailSubject}`,
          html: `<p>FYI: You have approved an appointment for <strong>${appt.patientName || user.firstName || 'Patient'}</strong>.</p><br>${emailHtml}`
        });
      } catch (emailErr) {
        console.error("Doctor copy email error:", emailErr);
      }
    }

    res.json({
      success: true,
      message: "Approved successfully",
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

// PATCH /api/appointments/:id/reject
router.patch("/:id/reject", auth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor') return res.status(403).json({
      success: false,
      message: "Forbidden"
    });

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

    // 📩 Professional HTML Email for Rejection (Async-safe)
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

      try {
        await transporter.sendMail({
          from: `Samyak Ayurvedic Hospital <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: emailSubject,
          html: emailHtml
        });
        console.log("Rejection email sent to patient:", user.email);
      } catch (emailErr) {
        console.error("Email Error:", emailErr);
      }

      // Email to Doctor (confirmation copy)
      try {
        const doctorEmail = process.env.DOCTOR_EMAIL || process.env.EMAIL_USER;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: doctorEmail,
          subject: `[DOCTOR COPY] ${emailSubject}`,
          html: `<p>FYI: You have rejected an appointment for <strong>${appt.patientName || user.firstName || 'Patient'}</strong>.</p><br>${emailHtml}`
        });
      } catch (emailErr) {
        console.error("Doctor copy email error:", emailErr);
      }
    }

    res.json({
      success: true,
      message: "Rejected successfully",
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

// --- ONE-CLICK EMAIL ACTIONS (Public Endpoints) ---

router.get("/action/approve", async (req, res) => {
  try {
    const {
      id,
      token
    } = req.query;
    if (!id || !token) return res.send("Invalid Request");

    // Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.appointmentId !== id) return res.send("Token Mismatch");

    const appt = await Appointment.findById(id);
    if (!appt) return res.send("Appointment not found");

    if (appt.status !== 'Pending') {
      return res.send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1 style="color:#d97706">Already Processed</h1>
          <p>This appointment is currently <strong>${appt.status}</strong> and cannot be modified via this link.</p>
          <a href="${process.env.FRONTEND_URL || '#'}" style="color:#155c3b; font-weight:600; text-decoration:none;">Visit Dashboard</a>
        </div>
      `);
    }

    // Update Logic
    appt.status = 'Approved';
    appt.approvedByDoctorAt = new Date();
    await appt.save();

    // Notify Patient
    const user = await User.findById(appt.patientId);
    if (user && user.email) {
      const mailOptions = {
        from: `"Samyak Hospital" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Appointment Approved – Samyak Ayurvedic Hospital",
        html: `
            <div style="font-family:sans-serif; padding:40px; border:1px solid #eaf4ee; border-radius:12px; max-width:500px; margin:auto;">
              <h2 style="color:#155c3b; margin-top:0;">Good News!</h2>
              <p>Hi ${user.firstName}, your appointment for <strong>${new Date(appt.date).toLocaleDateString()}</strong> at <strong>${appt.time}</strong> has been successfully approved.</p>
              <p>We look forward to seeing you at Samyak Ayurvedic Hospital.</p>
              <p style="margin-top:25px; color:#888; font-size:13px;">Warm Regards,<br>Dr. Rajan Karangiya</p>
            </div>`
      };
      transporter.sendMail(mailOptions);
    }

    res.send(`
      <div style="font-family:sans-serif; text-align:center; padding:50px; background:#f9fbf9; min-height:100vh;">
        <div style="background:#fff; padding:40px; border-radius:20px; display:inline-block; box-shadow:0 10px 30px rgba(0,0,0,0.05);">
          <h1 style="color:#155c3b; margin-top:0;">Approved Successfully!</h1>
          <p style="color:#4f6f60;">The appointment for <strong>${appt.patientName}</strong> has been confirmed.</p>
          <p style="font-size:14px; color:#8fab9f;">A confirmation email has been sent to the patient.</p>
        </div>
      </div>
    `);
  } catch (err) {
    console.error(err);
    res.send("Invalid or expired link. Please use the Doctor Dashboard.");
  }
});

router.get("/action/reject", async (req, res) => {
  try {
    const {
      id,
      token
    } = req.query;
    if (!id || !token) return res.send("Invalid Request");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.appointmentId !== id) return res.send("Token Mismatch");

    const appt = await Appointment.findById(id);
    if (!appt) return res.send("Appointment not found");

    if (appt.status !== 'Pending') {
      return res.send(`
        <div style="font-family:sans-serif; text-align:center; padding:50px;">
          <h1 style="color:#d97706">Already Processed</h1>
          <p>This appointment is currently <strong>${appt.status}</strong> and cannot be modified via this link.</p>
        </div>
      `);
    }

    appt.status = 'Rejected';
    appt.rejectedByDoctorAt = new Date();
    await appt.save();

    // Notify Patient
    const user = await User.findById(appt.patientId);
    if (user && user.email) {
      const mailOptions = {
        from: `"Samyak Hospital" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: "Appointment Update – Samyak Ayurvedic Hospital",
        html: `<p>Hi ${user.firstName}, we regret to inform you that your appointment request for ${new Date(appt.date).toLocaleDateString()} at ${appt.time} has been declined due to a schedule conflict. Please try booking another slot.</p>`
      };
      transporter.sendMail(mailOptions);
    }

    res.send(`
      <div style="font-family:sans-serif; text-align:center; padding:50px;">
        <h1 style="color:#b71c1c">Appointment Rejected</h1>
        <p>This request has been declined. The patient has been notified.</p>
      </div>
    `);
  } catch (err) {
    res.send("Invalid or expired link.");
  }
});

module.exports = router;
