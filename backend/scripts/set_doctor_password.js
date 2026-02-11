const connectDB = require('../config/db');
const Doctor = require('../models/Doctor');
const bcrypt = require('bcryptjs');

async function run() {
  await connectDB();
  const plain = 'admin123';
  const hash = await bcrypt.hash(plain, 10);
  const res = await Doctor.updateMany({}, {
    $set: {
      password: hash
    }
  });
  console.log('Updated doctors:', res.nModified || res.modifiedCount || res);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1)
});
