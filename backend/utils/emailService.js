const transporter = require("./email");

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
  
  const mailOptions = {
    from: `"Samyak Ayurvedic Hospital" <${process.env.EMAIL_USER}>`,
    to: patient.email,
    subject: 'Your Prescription – Samyak Ayurvedic Hospital',
    html: `
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
      `,
    attachments: [{
      filename: `Prescription_${patient.firstName || 'Patient'}.pdf`,
      content: pdfBuffer
    }]
  };

  try {
    const result = await transporter.sendMailWithLog(mailOptions);
    console.log(`✅ [sendPrescriptionEmail] Prescription email sent successfully to: ${patient.email}`);
    return result;
  } catch (error) {
    console.error(`❌ [sendPrescriptionEmail] Failed to send prescription to ${patient.email}:`, error.message);
    throw error;
  }
}

module.exports = {
  sendPrescriptionEmail
};
