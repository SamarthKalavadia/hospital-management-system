const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });
const User = require('../models/User');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const patients = await User.find({ role: 'patient' });
    console.log(`Found ${patients.length} patients`);

    let migrated = 0;
    for (const p of patients) {
      let changed = false;
      
      // If placeholder logic was never applied
      if (p.isPlaceholderEmail === undefined) {
        p.isPlaceholderEmail = (p.email && p.email.endsWith('@hospital.local'));
        p.canLogin = !p.isPlaceholderEmail;
        p.accountActivated = p.isAccountActivated || false;
        changed = true;
      }
      
      // If email is missing (unlikely given schema but safety first)
      if (!p.email) {
        const crypto = require('crypto');
        const tempId = crypto.randomBytes(3).toString('hex').toUpperCase();
        p.email = `patient_${tempId}@hospital.local`;
        p.isPlaceholderEmail = true;
        p.canLogin = false;
        p.accountActivated = false;
        changed = true;
      }

      if (changed) {
        await p.save();
        migrated++;
      }
    }

    console.log(`Migration complete. Updated ${migrated} records.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
