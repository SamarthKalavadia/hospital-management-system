require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const connectDB = require('../config/db');
const Doctor = require('../models/Doctor');

async function run() {
  await connectDB();
  
  let d = await Doctor.findOne();
  if (!d) {
    console.log('No doctor found in the local database. Seeding a default doctor account...');
    d = new Doctor({
      firstName: 'Rajan',
      lastName: 'Ayurvedic',
      email: 'doctor@hospital.com',
      password: 'admin123',
      isActive: true
    });
    await d.save();
    console.log('✅ Seeded default doctor successfully!');
  }
  
  console.log('\n--- DOCTOR CREDENTIALS ---');
  console.log(`Email ID: ${d.email}`);
  console.log('Password: admin123 (if newly seeded or reset)');
  console.log('--------------------------\n');
  console.log('Full Database Record:', d);
  process.exit(0);
}

run().catch(e => {
  console.error('Error running script:', e);
  process.exit(1);
});
