const transporter = require("./email");

const sendEmail = async (to, subject, text) => {
  console.log(`📧 [sendEmail] Starting email send to: ${to}`);
  
  try {
    await transporter.sendMailWithLog({
      from: `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text
    });
    console.log(`✅ [sendEmail] Email sent successfully to: ${to}`);
  } catch (error) {
    console.error(`❌ [sendEmail] Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

module.exports = sendEmail;
