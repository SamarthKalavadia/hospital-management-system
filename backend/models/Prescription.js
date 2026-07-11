const mongoose = require('mongoose');

const PrescriptionSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  patientName: String,
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
  diagnosis: String,
  medicines: [{
    medicineId: mongoose.Schema.Types.ObjectId,
    medicineName: String,
    dosage: String,
    duration: Number,
    instructions: String,
    qty: Number
  }],
  pdfPath: String,
  progressFeedback: {
    status: { type: String, enum: ['Better', 'Same', 'Worse', null], default: null },
    conditionName: String,
    comments: String,
    aiSummary: String,
    updatedAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Prescription', PrescriptionSchema);
