const mongoose = require("mongoose");
const Appointment = require("./models/Appointment");

async function check() {
    try {
        await mongoose.connect("mongodb+srv://samarth123:samarth@cluster0.heiczbp.mongodb.net/hospitalDB");
        console.log("Connected...");
        const appts = await Appointment.find({});
        console.log("Total Appointments:", appts.length);
        appts.forEach(a => {
            console.log(JSON.stringify({
                id: a._id,
                date: a.date,
                status: a.status,
                patient: a.patientName,
                time: a.time
            }, null, 2));
        });
    } catch (e) { console.error(e); }
    process.exit();
}

check();
