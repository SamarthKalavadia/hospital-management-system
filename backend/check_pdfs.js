const mongoose = require('mongoose');
require('dotenv').config();
const Prescription = require('./models/Prescription');
const fs = require('fs');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const list = await Prescription.find({ pdfPath: { $exists: true } });
        console.log(`Found ${list.length} prescriptions with pdfPath.`);
        
        list.forEach(p => {
            const exists = fs.existsSync(p.pdfPath);
            console.log(`ID: ${p._id}, Path: ${p.pdfPath}, Exists: ${exists}`);
        });
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
