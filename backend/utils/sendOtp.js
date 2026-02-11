const transporter = require("./email");

module.exports = async (email, otp) => {
  console.log(`📧 [sendOtp] Starting OTP email send to: ${email}`);
  
  try {
    await transporter.sendMailWithLog({
      from: `"Samyak Hospital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Verification Code",
      html: `
        <h2>OTP Verification</h2>
        <p>Your OTP is:</p>
        <h1>${otp}</h1>
        <p>Valid for 5 minutes.</p>
      `
    });
    console.log(`✅ [sendOtp] OTP email sent successfully to: ${email}`);
  } catch (error) {
    console.error(`❌ [sendOtp] Failed to send OTP to ${email}:`, error.message);
    throw error;
  }
};
