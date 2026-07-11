const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const patients = await User.find({ role: 'patient' });
    console.log(`Analyzing ${patients.length} patients...`);

    let updated = 0;
    for (const p of patients) {
      let changed = false;

      // 1. Initialize status if missing
      if (!p.status) {
          if (p.isPlaceholderEmail) {
              p.status = 'PENDING';
          } else if (p.password) {
              p.status = 'ACTIVE';
          } else {
              p.status = 'INVITED';
          }
          changed = true;
      }

      // 2. Safety Check: If marked as ACTIVE but no password
      if (p.status === 'ACTIVE' && !p.password) {
          p.status = (p.isPlaceholderEmail) ? 'PENDING' : 'INVITED';
          changed = true;
      }

      // 3. Sync legacy flags for safety (optional but good for consistency)
      // Actually we removed them from the model, so we don't need to save them.
      
      if (changed) {
        await p.save();
        updated++;
      }
    }

    console.log(`Migration complete. Updated ${updated} records.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
