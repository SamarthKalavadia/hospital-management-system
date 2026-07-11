const cron = require("node-cron");
const Appointment = require("../models/Appointment");
const twilio = require("twilio");

/* ===== TWILIO CONFIG ===== */
const client = new twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ===== CRON JOB ===== */
/* Runs every 10 minutes */
cron.schedule("*/10 * * * *", async () => {
  try {
    console.log("⏰ Checking for appointment reminders...");

    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

    const appointments = await Appointment.find({
      date: {
        $gte: now,
        $lte: nextHour
      },
      reminderSent: false
    });

    for (const appt of appointments) {
      await client.messages.create({
        body: `Reminder: You have an appointment at Samyak Ayurvedic Hospital on ${appt.date.toLocaleString()}`,
        from: process.env.TWILIO_PHONE,
        to: appt.patientPhone
      });

      appt.reminderSent = true;
      await appt.save();

      console.log("✅ Reminder sent to:", appt.patientPhone);
    }

  } catch (err) {
    console.error("❌ Reminder error:", err.message);
  }
});
