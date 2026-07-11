const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Appointment = require('./models/Appointment');

async function run() {
  try {
    console.log('Connecting to', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    
    const patients = await User.find({ role: 'patient' });
    let output = '--- PATIENTS ---\n';
    patients.forEach(p => {
        output += `${p._id} | ${p.firstName} ${p.lastName}\n`;
    });

    const appts = await Appointment.find({});
    output += '\n--- APPOINTMENTS ---\n';
    appts.forEach(a => {
        output += `${a._id} | ${a.date ? a.date.toISOString() : 'no date'} | ${a.status} | ${a.patientName} | Time:${a.time} | PID:${a.patientId}\n`;
    });

    fs.writeFileSync('db_dump.txt', output);
    console.log('Done.');
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('error.txt', err.stack);
    console.error(err);
    process.exit(1);
  }
}

run();
