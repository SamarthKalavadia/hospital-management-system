const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Medicine = require("../models/Medicine");

// GET /api/dashboard/doctor/:id? - returns basic counts for doctor dashboard
router.get("/doctor/:id?", auth, async (req, res) => {
  try {
    // only allow doctors
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden'
      });
    }

    const doctorId = req.user.id;

    // 1. Total Patients (Count all patients)
    const totalPatients = await User.countDocuments({ role: "patient" });

    // 2. Today appointments for this doctor
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = await Appointment.countDocuments({
      // Consider all appointments for now as standardizing doctorId across system
      date: {
        $gte: today,
        $lt: tomorrow
      },
      status: {
        $ne: 'Cancelled'
      }
    });

    // 3. Medicines low in stock (using dynamic alertLevel field)
    const allMeds = await Medicine.find({});
    const lowStock = allMeds.filter(m => m.quantity <= (m.alertLevel || 10)).length;

    res.json({
      totalPatients,
      todayAppointments,
      lowStock
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// GET /api/dashboard/patient/:id? - returns basic counts for PATIENT dashboard
router.get("/patient/:id?", auth, async (req, res) => {
  try {
    const patientId = req.user.id; // use token ID for security

    // 1. Total Appointments for this patient
    const totalAppointments = await Appointment.countDocuments({ patientId });

    // 2. Upcoming Appointments
    const upcoming = await Appointment.countDocuments({
      patientId,
      date: { $gte: new Date() },
      status: { $ne: 'Cancelled' }
    });

    res.json({
      totalAppointments,
      upcoming,
      appointmentsToday: 0 // Placeholder or actual calculation if needed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;
