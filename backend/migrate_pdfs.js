const mongoose = require('mongoose');
require('dotenv').config();
const Prescription = require('./models/Prescription');
const User = require('./models/User');
const { generatePrescriptionPDF } = require('./utils/pdfGenerator');
const fs = require('fs');
const path = require('path');

async function migrate() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to DB");

        const list = await Prescription.find({});
        console.log(`Updating all ${list.length} prescriptions with new branding.`);

        const uploadDir = path.join(__dirname, 'uploads', 'prescriptions');
        if (fs.existsSync(uploadDir)) {
            console.log("Cleaning old PDFs...");
            fs.rmSync(uploadDir, { recursive: true, force: true });
        }
        fs.mkdirSync(uploadDir, { recursive: true });

        for (const p of list) {
            console.log(`Generating PDF for ${p.patientName} (${p._id})...`);
            
            const patient = await User.findById(p.patientId);
            const doctor = await User.findById(p.doctorId);

            const pdfBuffer = await generatePrescriptionPDF({ patient, prescription: p, doctor });
            const fileName = `Prescription_${p._id}.pdf`;
            const filePath = path.join(uploadDir, fileName);
            fs.writeFileSync(filePath, pdfBuffer);

            p.pdfPath = filePath;
            await p.save();
        }

        console.log("Migration complete!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
