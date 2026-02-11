const connectDB = require('../config/db');
const Doctor = require('../models/Doctor');

async function run() {
  await connectDB();
  const d = await Doctor.findOne();
  console.log(d);
  process.exit(0);
}
run().catch(e => {
  console.error(e);
  process.exit(1)
});
