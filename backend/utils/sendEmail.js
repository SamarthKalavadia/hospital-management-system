const transporter = require("./email");

const sendEmail = async (to, subject, text) => {

  await transporter.sendMail({
    from: `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text
  });
};

module.exports = sendEmail;
