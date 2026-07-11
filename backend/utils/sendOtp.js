const { sendEmail } = require('./emailService');

/**
 * Send OTP verification email
 * @param {string} email - Recipient email
 * @param {string} otp - One-time password
 */
module.exports = async (email, otp) => {
  console.log(`📧 [sendOtp] Starting OTP email send to: ${email}`);
  console.log(`🔑 [DEVELOPER_NOTICE] The OTP code for ${email} is: ${otp}`);
  
  const htmlContent = `
    <h2>OTP Verification</h2>
    <p>Your OTP is:</p>
    <h1>${otp}</h1>
    <p>Valid for 5 minutes.</p>
  `;

  try {
    await sendEmail({
      to: email,
      subject: "Your OTP Verification Code",
      html: htmlContent,
      text: `Your OTP is: ${otp}. Valid for 5 minutes.`
    });
    console.log(`✅ [sendOtp] OTP email sent successfully to: ${email}`);
  } catch (error) {
    console.error(`❌ [sendOtp] Failed to send OTP to ${email}:`, error.message);
    throw error;
  }
};
