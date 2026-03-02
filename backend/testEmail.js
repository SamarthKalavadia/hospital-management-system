require("dotenv").config();
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: "samarth05012006@gmail.com",
  subject: "TEST EMAIL",
  text: "If you receive this, email works"
})
.then(() => console.log("EMAIL SENT"))
.catch(err => console.error("EMAIL ERROR:", err));
