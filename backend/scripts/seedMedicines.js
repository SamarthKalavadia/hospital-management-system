require('dotenv').config();
const mongoose = require('mongoose');
const { runMasterSeed } = require('../utils/medicineSeeder');

async function seed() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    await runMasterSeed();

    console.log('Seeding finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
