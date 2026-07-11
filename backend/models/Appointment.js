const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  patientId: mongoose.Schema.Types.ObjectId,
  patientName: String,
  patientPhone: String,
  date: Date,
  time: String,        // e.g. "09:00 AM"
  timeValue: String,   // e.g. "09:00"
  doctorId: mongoose.Schema.Types.ObjectId,
  status: {
    type: String,
    default: 'Pending',
    enum: ['Pending', 'Approved', 'Confirmed', 'Completed', 'Cancelled', 'Rejected']
  },
  reason: String,
  createdAt: { type: Date, default: Date.now },
  approvedByDoctorAt: { type: Date },
  rejectedByDoctorAt: { type: Date },
  reminderSent: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Appointment", appointmentSchema);
