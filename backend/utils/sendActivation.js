const transporter = require("./email");

module.exports = async (email, token, host) => {
  console.log(`📧 [sendActivation] Starting activation email send to: ${email}`);
  
  // Construct activation link using FRONTEND_URL environment variable
  const baseUrl = process.env.FRONTEND_URL;
  const link = `${baseUrl}/activate.html?token=${token}&email=${email}`;

  try {
    await transporter.sendMailWithLog({
      from: `"Samyak Hospital" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Activate Your Patient Account",
      text: `Welcome to Samyak Hospital. Please click the link to activate your account: ${link}`,
      html: `
        <h2>Welcome to Samyak Hospital</h2>
        <p>A patient record has been created for you.</p>
        <p>Please click the button below to set your password and activate your account:</p>
        <a href="${link}" style="display:inline-block;padding:10px 20px;background:#155c3b;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold;">Activate Account</a>
        <p style="margin-top:20px;font-size:12px;color:#666;">This link expires in 24 hours.</p>
      `
    });
    console.log(`✅ [sendActivation] Activation email sent successfully to: ${email}`);
  } catch (error) {
    console.error(`❌ [sendActivation] Failed to send activation email to ${email}:`, error.message);
    throw error;
  }
};
