require("dotenv").config();
const { sendEmail } = require("./utils/emailService");

// Send a test email to the user themselves (EMAIL_USER) or the default fallback email
const targetEmail = process.env.EMAIL_USER && process.env.EMAIL_USER !== "your-email@gmail.com" 
  ? process.env.EMAIL_USER 
  : "samarth05012006@gmail.com";

console.log(`🧪 Running email test... Target email: ${targetEmail}`);

sendEmail({
  to: targetEmail,
  subject: "TEST EMAIL (Nodemailer Migration)",
  html: "<h3>If you receive this, Nodemailer is working correctly!</h3><p>Samyak Ayurvedic Hospital Management System</p>",
  text: "If you receive this, Nodemailer is working correctly! Samyak Ayurvedic Hospital Management System"
})
.then(() => {
  console.log("🚀 Test execution call completed successfully.");
})
.catch(err => {
  console.error("❌ Test execution failed:", err);
});
