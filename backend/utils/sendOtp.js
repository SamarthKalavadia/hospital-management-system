const nodemailer = require("nodemailer");

const transporter = require("./email");

module.exports = async (email, otp) => {
  await transporter.sendMail({
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
};
// OTP sender utility — sends an email using configured transporter
