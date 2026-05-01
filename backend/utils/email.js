const sgMail = require("@sendgrid/mail");

// NOTE: API key is set lazily inside sendMailWithLog() so it always picks
// up the latest value from process.env after any credential rotation.

/**
 * Transporter object for backward compatibility
 * Now uses SendGrid instead of Nodemailer SMTP
 */
const transporter = {
  /**
   * Send email with logging (legacy interface)
   * @param {Object} mailOptions - Email options
   * @param {string} mailOptions.to - Recipient email
   * @param {string} mailOptions.subject - Email subject
   * @param {string} [mailOptions.html] - HTML content
   * @param {string} [mailOptions.text] - Plain text content
   * @param {string} [mailOptions.from] - Sender email (optional)
   * @param {Array} [mailOptions.attachments] - Email attachments (optional)
   */
  sendMailWithLog: async (mailOptions) => {
    // Set API key on every call so credential changes take effect immediately
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    console.log("📧 Email send via SendGrid:");
    console.log("   To:", mailOptions.to);
    console.log("   Subject:", mailOptions.subject);

    try {
      const msg = {
        to: mailOptions.to,
        from: {
          email: mailOptions.from || process.env.SENDGRID_FROM_EMAIL,
          name: "Samyak Ayurvedic Hospital"
        },
        subject: mailOptions.subject,
        html: mailOptions.html,
      };

      // Add optional text content
      if (mailOptions.text) {
        msg.text = mailOptions.text;
      }

      // Add optional attachments
      if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        msg.attachments = mailOptions.attachments.map(att => ({
          content: att.content.toString('base64'),
          filename: att.filename,
          type: att.type || 'application/octet-stream',
          disposition: 'attachment'
        }));
      }

      // Add optional headers
      if (mailOptions.replyTo) {
        msg.replyTo = mailOptions.replyTo;
      }

      await sgMail.send(msg);

      console.log("✅ Email sent successfully via SendGrid");
      console.log("   To:", msg.to);
      console.log("   Subject:", msg.subject);

      // Return mock info object for compatibility
      return {
        messageId: `<${Date.now()}@sendgrid>`,
        response: 'Email sent via SendGrid'
      };
    } catch (error) {
      console.error("❌ Email send FAILED:");
      console.error("   To:", mailOptions.to);
      console.error("   Subject:", mailOptions.subject);
      console.error("   Error:", error.response?.body || error.message);
      throw error;
    }
  },

  /**
   * Send email (legacy interface)
   * Alias for sendMailWithLog
   */
  sendMail: async (mailOptions) => {
    return transporter.sendMailWithLog(mailOptions);
  },

  /**
   * Verify transporter (no-op for SendGrid)
   * Kept for backward compatibility
   */
  verify: (callback) => {
    console.log("⚠️ transporter.verify() called - not needed with SendGrid API");
    if (callback) {
      callback(null, true);
    }
    return Promise.resolve(true);
  }
};

module.exports = transporter;
