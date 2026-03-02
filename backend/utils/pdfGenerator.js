const {
  jsPDF
} = require("jspdf");
require("jspdf-autotable");
const fs = require('fs');
const path = require('path');

/**
 * Generates a Prescription PDF using jsPDF on the backend
 * Replicates the EXACT flow from the doctor dashboard.
 */
async function generatePrescriptionPDF(data) {
  const {
    patient,
    prescription,
    doctor
  } = data;

  // Create doc
  const doc = new jsPDF();
  const green = "#155c3b";
  const lightGreen = "#f3f8f5";
  const darkText = "#2c3e50";
  const borderColor = "#dceae2";

  // Assets
  const logoRelPath = path.join('..', '..', 'frontend', 'assets', 'logo.png');
  const logoPath = path.resolve(__dirname, logoRelPath);

  // --- HELPER: Draw Logo Image ---
  const drawLogo = (centerX, centerY, size, op = 1, forceCircle = false) => {
    try {
      if (fs.existsSync(logoPath)) {
        const imgData = fs.readFileSync(logoPath).toString('base64');
        const r = size / 2;
        if (forceCircle) {
          // Shadow
          doc.setGState(new doc.GState({
            opacity: 0.12
          }));
          doc.setFillColor(0, 0, 0);
          doc.circle(centerX, centerY + 0.8, r + 2.5, 'F');

          // White Background
          doc.setGState(new doc.GState({
            opacity: 1
          }));
          doc.setFillColor(255, 255, 255);
          doc.circle(centerX, centerY, r + 2.5, 'F');
        }

        doc.setGState(new doc.GState({
          opacity: op
        }));
        doc.addImage(imgData, 'PNG', centerX - r, centerY - r, size, size, undefined, 'FAST');
        doc.setGState(new doc.GState({
          opacity: 1
        })); // Reset
      }
    } catch (e) {
      console.warn("Logo draw failed", e);
    }
  };

  // --- BACKGROUND WATERMARK ---
  drawLogo(105, 148, 110, 0.04);

  // --- TOP HEADER BAND ---
  doc.setFillColor(green);
  doc.rect(0, 0, 210, 45, 'F');

  // Logo on Header (Circular Container)
  drawLogo(30, 22.5, 25, 1, true);

  // Hospital Name
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  doc.text("SAMYAK", 54, 22);
  doc.setFontSize(18);
  doc.text("Ayurvedic Hospital", 54, 31);

  // Doctor Block
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Dr. ${doctor?.firstName || 'Rajan'} Karangiya`, 195, 18, {
    align: 'right'
  });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("B.A.M.S (RGUHS), CCP", 195, 24, {
    align: 'right'
  });
  doc.text("Reg No: G-12345", 195, 29, {
    align: 'right'
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Phone: +91 93280 52802", 195, 36, {
    align: 'right'
  });

  // --- PATIENT INFO AREA ---
  doc.setFillColor(lightGreen);
  doc.rect(15, 55, 180, 28, 'F');
  doc.setDrawColor(borderColor);
  doc.setLineWidth(0.3);
  doc.rect(15, 55, 180, 28);

  doc.setTextColor(green);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT NAME:", 20, 64);
  doc.text("AGE / GENDER:", 20, 74);
  doc.text("DATE:", 130, 64);
  doc.text("UHID:", 130, 74);

  doc.setTextColor(darkText);
  doc.setFontSize(10);
  doc.text((prescription.patientName || 'PATIENT').toUpperCase(), 52, 64);
  doc.text(`${patient?.age || '--'} / ${patient?.gender || '--'}`.toUpperCase(), 52, 74);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(prescription.createdAt).toLocaleDateString('en-IN'), 148, 64);
  doc.text(`PID-${String(prescription.patientId || '000').slice(-6).toUpperCase()}`, 148, 74);

  // --- UNIFIED HEADING RENDERER ---
  const drawHeading = (title, yPos) => {
    doc.setDrawColor(green);
    doc.setLineWidth(1.2);
    doc.line(15, yPos - 4.5, 15, yPos + 1.5);
    doc.setTextColor(green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, 20, yPos);
  };

  // --- DIAGNOSIS ---
  let currY = 98;
  drawHeading("DIAGNOSIS / COMPLAINTS", currY);
  doc.setTextColor(darkText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(prescription.diagnosis || "General Consultation", 15, currY + 9);

  // --- PRESCRIPTION TABLE ---
  currY += 28;
  drawHeading("PRESCRIPTION (Rx)", currY);

  const tableData = (prescription.medicines || []).map(m => [
    m.medicineName || m.name,
    String(m.dosage || m.dose || '--'),
    (m.duration || 0) + " Days",
    (m.qty || 1) + " U"
  ]);

  const {
    default: autoTable
  } = require("jspdf-autotable");
  autoTable(doc, {
    startY: currY + 5,
    head: [
      ['Medicine Name', 'Dosage', 'Duration', 'Qty']
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: green,
      textColor: 255,
      halign: 'center',
      fontStyle: 'bold'
    },
    bodyStyles: {
      textColor: darkText,
      fontSize: 10,
      cellPadding: 4
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        cellWidth: 80
      },
      1: {
        halign: 'center'
      },
      2: {
        halign: 'center'
      },
      3: {
        halign: 'center'
      }
    },
    margin: {
      left: 15,
      right: 15
    }
  });

  // --- INSTRUCTIONS ---
  const collectInstructions = () => {
    const list = [];
    if (prescription.notes) list.push(prescription.notes);
    (prescription.medicines || []).forEach(m => {
      if (m.instructions) list.push(`${m.medicineName || m.name}: ${m.instructions}`);
    });
    return list;
  };
  const dynamicInstructions = collectInstructions();

  if (dynamicInstructions.length > 0) {
    currY = doc.lastAutoTable.finalY + 15;
    drawHeading("INSTRUCTIONS", currY);

    doc.setDrawColor(borderColor);
    doc.setFillColor(252, 254, 253);
    const boxHeight = 6 + (dynamicInstructions.length * 5.5);
    doc.rect(15, currY + 4, 180, boxHeight, 'FD');

    doc.setTextColor(darkText);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    dynamicInstructions.forEach((t, i) => {
      const text = t.startsWith('•') ? t : `• ${t}`;
      doc.text(text, 20, currY + 10 + (i * 5.5));
    });
  }

  // --- FOOTER ---
  const footerY = 285;
  doc.setFillColor(green);
  doc.rect(0, footerY, 210, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.text("Address: 39/2/03/2, LMCTRC Nagar, Moti Palace Township, Junagadh, Gujarat - 362015", 105, footerY + 8, {
    align: 'center'
  });

  return Buffer.from(doc.output('arraybuffer'));
}

module.exports = {
  generatePrescriptionPDF
};
