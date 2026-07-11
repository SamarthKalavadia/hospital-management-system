const nodemailer = require("nodemailer");

// Cached ethereal test account to avoid creating a new one on every email send
let cachedTestAccount = null;

/**
 * Dynamically create and configure a Nodemailer transporter.
 * Picks up environment variables from process.env.
 * Automatically falls back to Ethereal Email if placeholders are detected.
 */
const getTransporter = async () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  // Detect placeholder values
  const isPlaceholder = !user || user === "your-email@gmail.com" || !pass || pass === "your-app-password";

  if (isPlaceholder) {
    if (!cachedTestAccount) {
      console.log("ℹ️  [Nodemailer] Placeholder email credentials detected. Generating temporary Ethereal testing account...");
      try {
        cachedTestAccount = await nodemailer.createTestAccount();
        console.log(`✅ [Nodemailer] Temporary test account generated: ${cachedTestAccount.user}`);
      } catch (err) {
        console.error("❌ [Nodemailer] Failed to generate Ethereal test account:", err.message);
      }
    }

    if (cachedTestAccount) {
      return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: cachedTestAccount.user,
          pass: cachedTestAccount.pass
        }
      });
    }
  }

  // Configuration object for general SMTP
  const smtpConfig = {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: user,
      pass: pass,
    },
  };

  // Optimization: use built-in "gmail" service config if user is using Gmail
  const isGmailHost = !process.env.EMAIL_HOST || process.env.EMAIL_HOST === "smtp.gmail.com";
  if (isGmailHost && user && user.endsWith("@gmail.com")) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: user,
        pass: pass,
      },
    });
  }

  return nodemailer.createTransport(smtpConfig);
};

/**
 * Transporter wrapper for backward compatibility with existing codebase
 */
const transporter = {
  /**
   * Send email with logging
   * @param {Object} mailOptions - Email options
   * @param {string} mailOptions.to - Recipient email
   * @param {string} mailOptions.subject - Email subject
   * @param {string} [mailOptions.html] - HTML content
   * @param {string} [mailOptions.text] - Plain text content
   * @param {string} [mailOptions.from] - Sender email (optional)
   * @param {Array} [mailOptions.attachments] - Email attachments (optional)
   */
  sendMailWithLog: async (mailOptions) => {
    try {
      const client = await getTransporter();
      
      console.log("📧 Email send via Nodemailer:");
      console.log("   To:", mailOptions.to);
      console.log("   Subject:", mailOptions.subject);

      const defaultFrom = cachedTestAccount ? cachedTestAccount.user : (process.env.EMAIL_USER || "noreply@samyakhospital.com");
      const fromAddress = mailOptions.from || process.env.EMAIL_FROM || defaultFrom;

      const msg = {
        from: `"Samyak Ayurvedic Hospital" <${fromAddress}>`,
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: mailOptions.html,
        text: mailOptions.text,
      };

      if (mailOptions.attachments && mailOptions.attachments.length > 0) {
        msg.attachments = mailOptions.attachments.map(att => ({
          filename: att.filename,
          content: att.content, // Nodemailer natively supports Buffer, string, or Stream
          contentType: att.type || att.contentType // Map standard types
        }));
      }

      if (mailOptions.replyTo) {
        msg.replyTo = mailOptions.replyTo;
      }

      const info = await client.sendMail(msg);
      console.log("✅ Email sent successfully via Nodemailer");
      console.log("   MessageID:", info.messageId);

      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) {
        console.log(`✉️  [DEVELOPER_NOTICE] Preview the sent email at: ${testUrl}`);
      }

      return info;
    } catch (error) {
      console.error("❌ Email send FAILED:");
      console.error("   To:", mailOptions.to);
      console.error("   Subject:", mailOptions.subject);
      console.error("   Error:", error.message);
      throw error;
    }
  },

  /**
   * Send email alias
   */
  sendMail: async (mailOptions) => {
    return transporter.sendMailWithLog(mailOptions);
  },

  /**
   * Verify transporter connection configuration
   */
  verify: async (callback) => {
    try {
      const client = await getTransporter();
      if (callback) {
        client.verify((err, success) => {
          callback(err, success);
        });
      } else {
        return client.verify();
      }
    } catch (err) {
      if (callback) callback(err);
      return Promise.reject(err);
    }
  }
};

module.exports = transporter;
