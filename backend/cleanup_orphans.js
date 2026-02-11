const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Prescription = require('./models/Prescription');

async function cleanupOrphans() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to database for cleanup...');

    // 1. Get all valid patient IDs
    const patients = await User.find({ role: 'patient' }).select('_id');
    const validPatientIds = patients.map(p => p._id.toString());
    console.log(`Found ${validPatientIds.length} valid patients in database.`);

    // 2. Cleanup Orphan Appointments
    const appointments = await Appointment.find({});
    let apptDeleted = 0;
    for (const appt of appointments) {
      if (!appt.patientId || !validPatientIds.includes(appt.patientId.toString())) {
        await Appointment.findByIdAndDelete(appt._id);
        apptDeleted++;
      }
    }
    console.log(`Deleted ${apptDeleted} orphan appointments.`);

    // 3. Cleanup Orphan Prescriptions
    const prescriptions = await Prescription.find({});
    let prescDeleted = 0;
    for (const presc of prescriptions) {
      if (!presc.patientId || !validPatientIds.includes(presc.patientId.toString())) {
        // Delete PDF if exists
        if (presc.pdfPath && fs.existsSync(presc.pdfPath)) {
          try { fs.unlinkSync(presc.pdfPath); } catch (e) {}
        }
        await Prescription.findByIdAndDelete(presc._id);
        prescDeleted++;
      }
    }
    console.log(`Deleted ${prescDeleted} orphan prescriptions.`);

    console.log('Cleanup complete. Database is now in sync.');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

cleanupOrphans();
