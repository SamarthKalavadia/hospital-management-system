const cron = require("node-cron");
const transporter = require("../utils/email");
const Appointment = require("../models/Appointment");
const User = require("../models/User");

// Run every 30 minutes
// Cron format: minute hour day month day-of-week
// "*/30 * * * *" means every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  console.log("Running appointment reminder job...");

  try {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // Look ahead 23 hours...
    // ...to 24.5 hours (slight buffer to catch jobs)
    // Actually, simpler logic:
    // Find appts where date is tomorrow (roughly) AND reminderSent is false.
    // A more robust logic for "24 hours before":
    // appointment date >= now + 23.5 hours AND appointment date <= now + 24.5 hours
    // But appointment schema splits date and time.
    // date field is Date object (often set to midnight or specific time)
    // time field is string "HH:MM".
    // We need to construct actual datetime

    // Let's grab all pending appointments in the future where reminderSent is false
    // Then filter in JS for precise timing to avoid complex mongo queries on split fields

    const appointments = await Appointment.find({
      status: {
        $ne: 'Cancelled'
      },
      reminderSent: {
        $ne: true
      },
      date: {
        $gte: new Date().setHours(0, 0, 0, 0)
      } // Only future/today dates
    });

    for (const appt of appointments) {
      // Construct full datetime
      const datePart = new Date(appt.date);
      const [hours, minutes] = (appt.time || "00:00").split(":");
      const apptDateTime = new Date(datePart);
      apptDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Calculate difference in hours
      const diffMs = apptDateTime - now;
      const diffHours = diffMs / (1000 * 60 * 60);

      // Check if between 23 and 25 hours (roughly 24 hours before)
      // This runs every 30 mins, so a 2-hour window is safe to ensure we catch it once
      if (diffHours >= 23 && diffHours <= 25) {

        // Convert time to AM/PM formatting
        let displayTime = appt.time;
        try {
          const [h, m] = appt.time.split(':');
          const H = parseInt(h);
          const ampm = H >= 12 ? 'PM' : 'AM';
          const h12 = H % 12 || 12;
          displayTime = `${h12}:${m} ${ampm}`;
        } catch (e) {}

        // Get User Email (if not stored in appointment, might need to fetch user)
        // We stored request patientName/Phone but created appointments via User ID usually
        let emailToSend = null;
        let userName = appt.patientName || "Patient";

        if (appt.patientId) {
          const u = await User.findById(appt.patientId);
          if (u) {
            emailToSend = u.email;
            userName = u.firstName || userName;
          }
        }

        if (emailToSend) {
          const mailOptions = {
            from: `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
            to: emailToSend,
            subject: "Appointment Reminder – Samyak Ayurvedic Hospital",
            html: `
                      <div style="font-family: 'Segoe UI', sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                        <div style="background-color: #155c3b; color: #fff; padding: 20px; text-align: center;">
                          <h2 style="margin: 0; font-size: 24px;">Appointment Reminder</h2>
                        </div>
                        <div style="padding: 30px;">
                          <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${userName}</strong>,</p>
                          <p style="font-size: 16px; margin-bottom: 25px; line-height: 1.5;">This is a friendly reminder for your upcoming appointment.</p>
                          
                          <div style="background-color: #f9fbf9; border-left: 4px solid #155c3b; padding: 20px; margin-bottom: 25px; border-radius: 4px;">
                            <h3 style="margin: 0 0 15px 0; color: #155c3b; font-size: 18px;">Appointment Details</h3>
                            <p style="margin: 5px 0;"><strong>Date:</strong> ${datePart.toLocaleDateString()}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> ${displayTime}</p>
                            <p style="margin: 5px 0;"><strong>Hospital:</strong> Samyak Ayurvedic Hospital</p>
                          </div>
            
                          <p style="font-size: 14px; color: #666; margin-bottom: 30px;">Please arrive at least 10 minutes early for a smooth consultation.</p>
                          
                          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                          
                          <p style="font-size: 16px; margin-bottom: 5px;">Wishing you good health,</p>
                          <p style="font-size: 16px; font-weight: bold; color: #155c3b; margin: 0;">Samyak Ayurvedic Hospital</p>
                        </div>
                      </div>
                    `
          };

          await transporter.sendMail(mailOptions);
          console.log(`Reminder sent to ${emailToSend} for appointment ${appt._id}`);

          // Mark as sent
          appt.reminderSent = true;
          await appt.save();
        }
      }
    }

  } catch (error) {
    console.error("Error in reminder cron job:", error);
  }
});

// AUTO-COMPLETE TASK: Mark passed appointments as COMPLETED
// Run every 15 minutes
cron.schedule("*/15 * * * *", async () => {
  console.log("Running auto-complete passed appointments job...");
  try {
    const now = new Date();
    
    // Find all Approved/Confirmed/Pending appointments that might have passed
    const appts = await Appointment.find({
      status: { $in: ['Approved', 'Confirmed', 'Pending'] }
    });

    for (const appt of appts) {
      if (!appt.date) continue;
      
      const datePart = new Date(appt.date);
      const apptDateTime = new Date(datePart);
      
      if (appt.time) {
        const parts = appt.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (parts) {
            let h = parseInt(parts[1]), m = parseInt(parts[2]), ampm = (parts[3] || '').toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            apptDateTime.setHours(h, m, 0, 0);
        } else {
            apptDateTime.setHours(23, 59, 59);
        }
      } else {
        apptDateTime.setHours(23, 59, 59);
      }

      // If scheduled time is more than 30 mins ago, auto-complete
      // We give a 30 mins buffer for the actual visit time
      if (apptDateTime.getTime() < (now.getTime() - 30 * 60 * 1000)) {
        appt.status = 'Completed';
        await appt.save();
        console.log(`Auto-completed appointment: ${appt._id} for ${appt.patientName}`);
      }
    }
  } catch (e) {
    console.error("Auto-complete job failed:", e);
  }
});

module.exports = cron;
