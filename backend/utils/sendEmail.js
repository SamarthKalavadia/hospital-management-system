const { sendEmail: sendEmailService } = require('./emailService');

/**
 * Simple email sender wrapper
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 */
const sendEmail = async (to, subject, text) => {
  console.log(`📧 [sendEmail] Starting email send to: ${to}`);
  
  try {
    await sendEmailService({
      to,
      subject,
      html: `<p>${text}</p>`,
      text
    });
    console.log(`✅ [sendEmail] Email sent successfully to: ${to}`);
  } catch (error) {
    console.error(`❌ [sendEmail] Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

module.exports = sendEmail;
