const transporter = require('./email');

/**
 * Send email using Nodemailer utility
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML email content
 * @param {string} [options.text] - Plain text email content (optional)
 * @param {Array} [options.attachments] - Email attachments (optional)
 */
const sendEmail = async ({ to, subject, html, text, attachments }) => {
  try {
    const mailOptions = {
      to,
      subject,
      html,
      text,
      attachments
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully to:', to);
  } catch (error) {
    console.error('❌ Nodemailer email error:', error.message);
    // Don't throw - email failures should not crash the server
  }
};

/**
 * Send prescription email with PDF attachment
 */
async function sendPrescriptionEmail(options) {
  const {
    patient,
    doctor,
    pdfBuffer
  } = options;

  if (!patient || !patient.email) {
    throw new Error("Patient email missing");
  }

  console.log(`📧 [sendPrescriptionEmail] Starting prescription email send to: ${patient.email}`);
  
  const htmlContent = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eaf4ee; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #155c3b; color: #fff; padding: 30px; text-align: center;">
        <h2 style="margin: 0;">Prescription Issued</h2>
      </div>
      <div style="padding: 30px;">
        <p>Dear <strong>${patient.firstName || 'Patient'}</strong>,</p>
        <p>Please find attached your prescription issued today by <strong>Dr. ${doctor?.firstName || 'Rajan'}</strong>.</p>
        <p>We recommend following the dosage instructions carefully for effective recovery.</p>
        
        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
          <p style="margin: 0; color: #4f6f60; font-weight: 600;">Samyak Ayurvedic Hospital</p>
          <p style="font-size: 13px; color: #888;">Wishing you good health.</p>
        </div>
      </div>
    </div>
  `;

  try {
    await sendEmail({
      to: patient.email,
      subject: 'Your Prescription – Samyak Ayurvedic Hospital',
      html: htmlContent,
      attachments: [{
        filename: `Prescription_${patient.firstName || 'Patient'}.pdf`,
        content: pdfBuffer,
        type: 'application/pdf'
      }]
    });
    console.log(`✅ [sendPrescriptionEmail] Prescription email sent successfully to: ${patient.email}`);
  } catch (error) {
    console.error(`❌ [sendPrescriptionEmail] Failed to send prescription to ${patient.email}:`, error.message);
    throw error;
  }
}

module.exports = {
  sendEmail,
  sendPrescriptionEmail
};
