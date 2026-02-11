const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email transporter verification FAILED:", error.message);
  } else {
    console.log("✅ Email transporter is ready to send messages");
  }
});

// Wrapper function for sending emails with better logging
transporter.sendMailWithLog = async (mailOptions) => {
  // Ensure proper headers for deliverability
  const enhancedOptions = {
    ...mailOptions,
    from: mailOptions.from || `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
    replyTo: process.env.EMAIL_USER,
    headers: {
      'X-Priority': '1',
      'X-Mailer': 'Samyak Hospital System'
    }
  };

  try {
    const info = await transporter.sendMail(enhancedOptions);
    console.log("📧 Email sent successfully:");
    console.log("   To:", enhancedOptions.to);
    console.log("   Subject:", enhancedOptions.subject);
    console.log("   MessageId:", info.messageId);
    console.log("   Response:", info.response);
    return info;
  } catch (err) {
    console.error("❌ Email send FAILED:");
    console.error("   To:", enhancedOptions.to);
    console.error("   Subject:", enhancedOptions.subject);
    console.error("   Error:", err.message);
    throw err;
  }
};

module.exports = transporter;
