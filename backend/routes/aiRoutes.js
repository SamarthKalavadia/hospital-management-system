/**
 * AI Prescription Draft Assistant API
 * 
 * PURPOSE:
 * Assist the doctor by generating a draft Ayurvedic prescription based on symptoms and diagnosis.
 * The doctor must review, edit, and approve the prescription before saving.
 * 
 * RULES:
 * - DO NOT auto-save anything
 * - DO NOT replace doctor decision
 * - DO NOT diagnose disease
 * - Doctor must manually edit or approve
 * - AI must never override doctor
 * - No emergency or diagnosis wording
 * - No patient-facing language
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Medicine = require('../models/Medicine');
// const { seedMedicine } = require('../utils/medicineSeeder'); // Removed as per Part 1 & 2 requirements

// Common Ayurvedic formulations database for quick reference
const AYURVEDIC_FORMULATIONS = {
  // Digestive Issues
  digestive: [
    { name: 'Hingwashtak Churna', category: 'churna', commonDose: '3-5g', frequency: 'twice daily', typicalDuration: 15 },
    { name: 'Avipattikar Churna', category: 'churna', commonDose: '3-5g', frequency: 'before meals', typicalDuration: 21 },
    { name: 'Triphala Churna', category: 'churna', commonDose: '3-5g', frequency: 'at bedtime', typicalDuration: 30 },
    { name: 'Hingwashtak Vati', category: 'tablet', commonDose: '1-2 tablets', frequency: 'after meals', typicalDuration: 15 },
    { name: 'Abhayarishta', category: 'asava', commonDose: '15-30ml', frequency: 'after meals', typicalDuration: 30 },
    { name: 'Kutajarishta', category: 'asava', commonDose: '20ml', frequency: 'after meals', typicalDuration: 15 }
  ],
  
  // Respiratory Issues
  respiratory: [
    { name: 'Sitopaladi Churna', category: 'churna', commonDose: '3g', frequency: 'twice daily with honey', typicalDuration: 14 },
    { name: 'Talisadi Churna', category: 'churna', commonDose: '3g', frequency: 'twice daily', typicalDuration: 14 },
    { name: 'Swasamrutham Syrup', category: 'syrup', commonDose: '10ml', frequency: 'thrice daily', typicalDuration: 14 },
    { name: 'Kantakari Avaleha', category: 'others', commonDose: '5-10g', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Vasavaleha', category: 'others', commonDose: '5-10g', frequency: 'twice daily', typicalDuration: 21 }
  ],
  
  // Joint & Musculoskeletal
  musculoskeletal: [
    { name: 'Yograj Guggulu', category: 'tablet', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Kaishore Guggulu', category: 'tablet', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Mahanarayan Taila', category: 'oil', commonDose: '--', frequency: 'external application', typicalDuration: 30 },
    { name: 'Dhanwantharam Taila', category: 'oil', commonDose: '--', frequency: 'external application', typicalDuration: 30 },
    { name: 'Sahacharadi Taila', category: 'oil', commonDose: '--', frequency: 'external application', typicalDuration: 30 }
  ],
  
  // Skin Conditions
  skin: [
    { name: 'Arogyavardhini Vati', category: 'tablet', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Kaishore Guggulu', category: 'tablet', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 30 }
  ],
  
  // Fever & General Infections
  fever: [
    { name: 'Sudarshan Ghan Vati', category: 'tablet', commonDose: '2 tablets', frequency: 'thrice daily', typicalDuration: 7 },
    { name: 'Amritarishta', category: 'asava', commonDose: '20ml', frequency: 'after meals', typicalDuration: 14 },
    { name: 'Tribhuvan Kirti Rasa', category: 'tablet', commonDose: '125mg', frequency: 'twice daily', typicalDuration: 5 },
    { name: 'Giloy Ghan Vati', category: 'tablet', commonDose: '1 tablet', frequency: 'twice daily', typicalDuration: 15 },
    { name: 'Sanjeevani Vati', category: 'tablet', commonDose: '1 tablet', frequency: 'twice daily', typicalDuration: 7 }
  ],
  
  // Stress & Anxiety
  stress: [
    { name: 'Brahmi Vati', category: 'vati', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Ashwagandha Churna', category: 'churna', commonDose: '3-5g', frequency: 'with milk at bedtime', typicalDuration: 30 },
    { name: 'Shankhpushpi Syrup', category: 'syrup', commonDose: '10ml', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Saraswatarishta', category: 'arishta', commonDose: '20ml', frequency: 'after meals', typicalDuration: 30 },
    { name: 'Jatamansi Churna', category: 'churna', commonDose: '1-2g', frequency: 'at bedtime', typicalDuration: 21 }
  ],
  
  // Women's Health
  gynecological: [
    { name: 'Ashokarishta', category: 'arishta', commonDose: '20ml', frequency: 'after meals', typicalDuration: 30 },
    { name: 'Dashmool Kwath', category: 'kwath', commonDose: '30ml', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Pushyanug Churna', category: 'churna', commonDose: '3g', frequency: 'twice daily with rice water', typicalDuration: 21 },
    { name: 'Lodhra Churna', category: 'churna', commonDose: '3g', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Shatavari Churna', category: 'churna', commonDose: '3-5g', frequency: 'with milk', typicalDuration: 30 }
  ],
  
  // Urinary Issues
  urinary: [
    { name: 'Chandraprabha Vati', category: 'vati', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Gokshuradi Guggulu', category: 'guggulu', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Punarnavadi Kwath', category: 'kwath', commonDose: '30ml', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Shilajit Vati', category: 'vati', commonDose: '1 tablet', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Varuna Ghan Vati', category: 'vati', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 21 }
  ],
  
  // General Weakness / Immunity
  general: [
    { name: 'Chyawanprash', category: 'syrup', commonDose: '10g', frequency: 'twice daily with milk', typicalDuration: 30 },
    { name: 'Dashmoolarishta', category: 'asava', commonDose: '20ml', frequency: 'after meals', typicalDuration: 30 },
    { name: 'Balarishta', category: 'asava', commonDose: '20ml', frequency: 'after meals', typicalDuration: 30 },
    { name: 'Draksharishta', category: 'asava', commonDose: '20ml', frequency: 'after meals', typicalDuration: 30 }
  ],

  // Headache/Migraine
  headache: [
    { name: 'Pathyadi Kwath', category: 'kwath', commonDose: '30ml', frequency: 'twice daily', typicalDuration: 14 },
    { name: 'Shirashooladi Vajra Ras', category: 'ras', commonDose: '125mg', frequency: 'twice daily', typicalDuration: 14 },
    { name: 'Godanti Bhasma', category: 'bhasma', commonDose: '250mg', frequency: 'twice daily with honey', typicalDuration: 14 },
    { name: 'Brahmi Vati', category: 'vati', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 21 }
  ],

  // Acidity/GERD
  acidity: [
    { name: 'Avipattikar Churna', category: 'churna', commonDose: '3-5g', frequency: 'before meals', typicalDuration: 21 },
    { name: 'Kamdudha Ras', category: 'ras', commonDose: '250mg', frequency: 'twice daily', typicalDuration: 14 },
    { name: 'Praval Pishti', category: 'pishti', commonDose: '250mg', frequency: 'twice daily', typicalDuration: 21 },
    { name: 'Sutshekhar Ras', category: 'ras', commonDose: '125mg', frequency: 'twice daily', typicalDuration: 14 }
  ],

  // Diabetes Management (Adjuvant)
  diabetes: [
    { name: 'Chandraprabha Vati', category: 'vati', commonDose: '2 tablets', frequency: 'twice daily', typicalDuration: 30 },
    { name: 'Nishamalaki Churna', category: 'churna', commonDose: '3g', frequency: 'at bedtime', typicalDuration: 30 },
    { name: 'Gudmar Churna', category: 'churna', commonDose: '3g', frequency: 'before meals', typicalDuration: 30 },
    { name: 'Shilajit Vati', category: 'vati', commonDose: '1 tablet', frequency: 'twice daily', typicalDuration: 30 }
  ]
};

// Keywords for condition mapping
const CONDITION_KEYWORDS = {
  digestive: ['digestion', 'gas', 'bloating', 'constipation', 'diarrhea', 'indigestion', 'appetite', 'stomach', 'abdominal', 'acidity', 'flatulence', 'ibs', 'bowel'],
  respiratory: ['cough', 'cold', 'bronchitis', 'asthma', 'wheeze', 'phlegm', 'mucus', 'sinusitis', 'breathlessness', 'chest congestion', 'throat', 'sore throat'],
  musculoskeletal: ['joint', 'arthritis', 'pain', 'back pain', 'knee', 'shoulder', 'muscle', 'stiffness', 'swelling', 'rheumatoid', 'osteo', 'sciatica', 'cervical', 'spondylitis'],
  skin: ['skin', 'eczema', 'psoriasis', 'acne', 'rash', 'itching', 'dermatitis', 'fungal', 'urticaria', 'boils', 'wound'],
  fever: ['fever', 'infection', 'viral', 'flu', 'malaria', 'typhoid', 'temperature', 'chills'],
  stress: ['stress', 'anxiety', 'insomnia', 'sleep', 'tension', 'depression', 'nervousness', 'mental', 'fatigue', 'memory', 'concentration'],
  gynecological: ['menstrual', 'period', 'pcod', 'pcos', 'leucorrhea', 'menopause', 'uterine', 'ovarian', 'dysmenorrhea', 'amenorrhea', 'irregular cycle'],
  urinary: ['urine', 'urinary', 'kidney', 'stone', 'uti', 'burning micturition', 'prostate', 'bladder', 'renal'],
  general: ['weakness', 'fatigue', 'immunity', 'energy', 'debility', 'convalescence', 'weight loss', 'anemia', 'general health'],
  headache: ['headache', 'migraine', 'head pain', 'tension headache', 'cluster headache'],
  acidity: ['acidity', 'heartburn', 'gerd', 'reflux', 'hyperacidity', 'ulcer'],
  diabetes: ['diabetes', 'sugar', 'blood sugar', 'glycemic', 'prameha']
};

/**
 * Analyze symptoms and diagnosis to determine condition category
 */
function analyzeCondition(symptoms, diagnosis) {
  const combinedText = `${symptoms} ${diagnosis}`.toLowerCase();
  const matchedCategories = [];
  
  for (const [category, keywords] of Object.entries(CONDITION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        matchedCategories.push(category);
        break;
      }
    }
  }
  
  // Return unique categories or default to general
  return [...new Set(matchedCategories)].length > 0 ? [...new Set(matchedCategories)] : ['general'];
}

/**
 * Generate prescription draft based on patient data
 */
function generatePrescriptionDraft(patientAge, patientGender, symptoms, diagnosis, visitType, availableMedicines) {
  const categories = analyzeCondition(symptoms, diagnosis);
  const suggestions = [];
  const notes = [];
  
  // Age-based dosage adjustments
  let doseMultiplier = 1;
  let ageNote = '';
  
  const age = parseInt(patientAge) || 30;
  if (age < 12) {
    doseMultiplier = 0.5;
    ageNote = 'Pediatric dosage applied (half dose)';
  } else if (age > 60) {
    doseMultiplier = 0.75;
    ageNote = 'Geriatric consideration (reduced dose recommended)';
  }
  
  if (ageNote) notes.push(ageNote);
  
  // Gender-specific considerations
  if (patientGender?.toLowerCase() === 'female' && categories.includes('gynecological')) {
    notes.push('Female-specific formulations prioritized');
  }
  
  // Visit type consideration
  if (visitType === 'follow-up') {
    notes.push('Follow-up visit: Consider adjusting based on previous response');
  }
  
  // Get available medicine names for matching
  const availableMedNames = availableMedicines.map(m => m.name.toLowerCase());
  
  // Track already added medicines to avoid duplicates
  const addedMedicineNames = new Set();
  
  // Collect medicines from matched categories (limit to 2-4 per category, max 4 total)
  let totalSelected = 0;
  const maxMedicines = 4;
  
  for (const category of categories) {
    if (totalSelected >= maxMedicines) break;
    
    const categoryFormulations = AYURVEDIC_FORMULATIONS[category] || [];
    const remaining = maxMedicines - totalSelected;
    const toSelect = Math.min(2, remaining);
    
    // Prioritize formulations that are in stock and not already added
    const sortedFormulations = [...categoryFormulations]
      .filter(f => !addedMedicineNames.has(f.name.toLowerCase()))
      .sort((a, b) => {
        const aInStock = availableMedNames.some(name => name.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(name));
        const bInStock = availableMedNames.some(name => name.includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(name));
        return bInStock - aInStock;
      });
    
    let addedFromCategory = 0;
    for (let i = 0; i < sortedFormulations.length && addedFromCategory < toSelect; i++) {
      const formulation = sortedFormulations[i];
      
      // Skip if already added
      if (addedMedicineNames.has(formulation.name.toLowerCase())) continue;
      
      // Part 1 & 2: STRICT SINGLE SOURCE OF TRUTH
      // Check if medicine exists in inventory
      const stockMatch = availableMedicines.find(m => 
        m.name.toLowerCase().trim() === formulation.name.toLowerCase().trim()
      );
      
      let medData = stockMatch;
      let inInventory = true;

      if (!stockMatch) {
         // Part 7: FAILSAFE RULE - Medicine not in inventory
         inInventory = false;
         medData = {
           name: formulation.name,
           quantity: 0,
           _id: null
         };
      }
      
      // Calculate adjusted duration
      let duration = formulation.typicalDuration;
      if (visitType === 'follow-up') {
        duration = Math.min(duration, 14); // Shorter duration for follow-ups
      }
      
      // Add medicine name to tracking set
      addedMedicineNames.add(medData.name.toLowerCase());
      
      suggestions.push({
        name: medData.name,
        dosage: formulation.commonDose,
        frequency: formulation.frequency,
        duration: duration,
        qty: Math.ceil(duration / (formulation.frequency.includes('twice') ? 2 : formulation.frequency.includes('thrice') ? 1 : 3)) * (formulation.frequency.includes('twice') ? 2 : formulation.frequency.includes('thrice') ? 3 : 1),
        inStock: (medData.quantity > 0),
        inInventory: inInventory, // NEW: Track inventory existence
        stockQty: medData.quantity,
        instructions: formulation.frequency,
        category: formulation.category
      });
      
      totalSelected++;
      addedFromCategory++;
    }
  }
  
  // Add condition-specific notes
  if (categories.includes('digestive')) {
    notes.push('Advise light, easily digestible diet');
  }
  if (categories.includes('respiratory')) {
    notes.push('Avoid cold foods and exposure to cold air');
  }
  if (categories.includes('stress')) {
    notes.push('Recommend lifestyle modifications and adequate rest');
  }
  
  return {
    medicines: suggestions,
    notes: notes,
    detectedCategories: categories
  };
}

/**
 * POST /api/ai/prescription-draft
 * Generate AI-suggested prescription draft
 */
router.post('/prescription-draft', auth, async (req, res) => {
  try {
    // Only doctors can use this feature
    if (!req.user || req.user.role !== 'doctor') {
      return res.status(403).json({
        success: false,
        message: 'Only doctors can access AI prescription assistant'
      });
    }

    const { patientAge, patientGender, symptoms, diagnosis, visitType } = req.body;

    // Validate required fields
    if (!diagnosis && !symptoms) {
      return res.status(400).json({
        success: false,
        message: 'Please provide symptoms or diagnosis for AI suggestions'
      });
    }

    // Fetch available medicines from inventory
    const availableMedicines = await Medicine.find({}).lean();

    // Generate draft prescription
    const draft = generatePrescriptionDraft(
      patientAge,
      patientGender,
      symptoms || '',
      diagnosis || '',
      visitType || 'first',
      availableMedicines
    );

    // Format response
    const formattedPrescription = draft.medicines.map((m, idx) => ({
      id: idx + 1,
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
      duration: `${m.duration} days`,
      durationDays: m.duration,
      qty: m.qty,
      instructions: m.instructions,
      inStock: m.inStock,
      inInventory: m.inInventory, // NEW: Pass down to frontend
      stockQty: m.stockQty
    }));

    res.json({
      success: true,
      message: 'AI suggestion generated. Please review and modify as needed before saving.',
      disclaimer: 'This is a suggested draft only. The doctor must review, edit, and approve before finalizing.',
      prescription: {
        medicines: formattedPrescription,
        notes: draft.notes,
        detectedConditions: draft.detectedCategories
      }
    });

  } catch (err) {
    console.error('AI Prescription Draft Error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate prescription draft'
    });
  }
});

/**
 * POST /api/ai/medicine-demand
 * Predict medicine demand based on stock and usage
 */
router.post('/medicine-demand', auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { medicineName, currentStock, dailyAverageUsage } = req.body;

    // Strict Input Validation
    if (!medicineName || typeof currentStock !== 'number' || typeof dailyAverageUsage !== 'number') {
        return res.json({
            status: "Normal",
            estimatedDays: "Insufficient data",
            suggestion: "Monitor usage periodically"
        });
    }

    // Logic: Usage 0 -> Normal
    if (dailyAverageUsage <= 0) {
        return res.json({
            status: "Normal",
            estimatedDays: "Usage too low to estimate",
            suggestion: "Stock levels appear stable"
        });
    }

    // Deterministic Calculation
    const estimatedDays = Math.floor(currentStock / dailyAverageUsage);

    let status = "Normal";
    let suggestion = "Stock levels are healthy.";

    if (estimatedDays < 7) {
        status = "Critical";
        suggestion = "Restock immediately to avoid shortage.";
    } else if (estimatedDays >= 7 && estimatedDays <= 15) {
        status = "Low";
        suggestion = "Plan procurement soon.";
    }

    return res.json({
        status: status,
        estimatedDays: estimatedDays,
        suggestion: suggestion
    });

  } catch (err) {
    console.error("AI Demand Error:", err);
    return res.json({
        status: "Normal",
        estimatedDays: "N/A",
        suggestion: "Monitor usage manually"
    });
  }
});

/**
 * POST /api/ai/symptom-progress
 * Summarize patient-reported symptom progress into a short, neutral clinical note
 */
router.post('/symptom-progress', auth, async (req, res) => {
  try {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { initialSymptoms, daysSincePrescription, patientFeedback, optionalComments } = req.body;

    // Strict Validation
    if (!initialSymptoms || typeof daysSincePrescription !== 'number' || daysSincePrescription < 1 || !['Better', 'Same', 'Worse'].includes(patientFeedback)) {
       return res.json({
           summary: {
             trend: "No change",
             duration: typeof daysSincePrescription === 'number' ? daysSincePrescription : 0,
             note: "Patient-reported feedback was insufficient to determine clear symptom progression."
           }
       });
    }

    // Deterministic Logic
    let trend = "No change";
    let note = "Patient reports status is unchanged from previous visit.";

    if (patientFeedback === 'Better') {
        trend = "Improving";
        note = "Patient reports reduced symptom severity with gradual improvement over the observed period.";
        if (optionalComments && optionalComments.toLowerCase().includes('pain')) {
             note = "Patient reports improvement in pain levels and general comfort.";
        }
    } else if (patientFeedback === 'Worsening') {
        trend = "Worsening";
        note = "Patient reports increase in symptom intensity; reassessment may be required.";
    }

    const formattedSummary = `Progress Summary:\n• Symptom trend: ${trend}\n• Duration observed: ${daysSincePrescription} days\n• Clinical note: ${note}`;

    return res.json({
        success: true,
        summary: {
           trend: trend,
           duration: daysSincePrescription,
           note: note
        },
        formattedSummary: formattedSummary
    });

  } catch (err) {
    console.error("AI Progress Summary Error:", err);
    const fallback = `Progress Summary:\n• Symptom trend: No change\n• Duration observed: 0 days\n• Clinical note: Patient-reported feedback was insufficient to determine clear symptom progression.`;
    return res.json({
        success: false,
        summary: {
             trend: "No change",
             duration: 0,
             note: "Patient-reported feedback was insufficient to determine clear symptom progression."
        },
        formattedSummary: fallback
    });
  }
});

/**
 * POST /api/ai/patient-assistant
 * AI-Guided Help & Account Assistant for Patients
 */
router.post('/patient-assistant', auth, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'patient') {
      return res.status(403).json({ success: false, message: 'Only patients can access the help assistant' });
    }

    const { message } = req.body;
    const msg = (message || '').toLowerCase();
    const User = require('../models/User');
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // 1. STRICTURE: MEDICAL QUESTIONS
    const medicalKeywords = ['medicine', 'pain', 'fever', 'symptom', 'diagnose', 'treatment', 'cureBuilder', 'disease', 'dosage', 'better', 'worse', 'tablets', 'capsule'];
    const isMedical = medicalKeywords.some(k => msg.includes(k)) && !msg.includes('feedback') && !msg.includes('how to');
    
    if (isMedical) {
      return res.json({
        success: true,
        reply: "I can help with system or account-related questions. Please consult your doctor for medical guidance."
      });
    }

    // 2. PASSWORD RESET FLOW
    if (msg.includes('password') && (msg.includes('reset') || msg.includes('forgot') || msg.includes('change'))) {
      return res.json({
        success: true,
        reply: "You can change your password from your Profile settings. Click on your name in the top-right corner and select 'Change Password'."
      });
    }

    // 3. PROFILE UPDATE
    if (msg.includes('profile') || msg.includes('update detail') || msg.includes('change name')) {
      return res.json({
        success: true,
        reply: "To update your profile:\n• Go to the sidebar on your dashboard.\n• Currently, profile updates require administrative assistance for security.\n• Please contact the hospital helpdesk to update your phone number or name."
      });
    }

    // 4. NAVIGATION: PRESCRIPTIONS
    if (msg.includes('prescription') || msg.includes('record') || msg.includes('report')) {
      return res.json({
        success: true,
        reply: "To view your prescriptions:\n• Click on 'Medical Records' in the sidebar.\n• You will see a list of all your consultations.\n• Click 'Download Prescription (PDF)' to save a copy."
      });
    }

    // 5. NAVIGATION: APPOINTMENTS
    if (msg.includes('appointment') || msg.includes('book') || msg.includes('cancel')) {
      return res.json({
        success: true,
        reply: "To manage appointments:\n• Use the 'Book New Appointment' card on your dashboard overview.\n• To view or cancel existing ones, click 'My Appointments' in the sidebar.\n• You can reschedule or cancel up to 24 hours before the appointment."
      });
    }

    // 6. NAVIGATION: RECOVERY FEEDBACK
    if (msg.includes('feedback') || msg.includes('recovery') || msg.includes('how am i feeling')) {
      return res.json({
        success: true,
        reply: "To submit recovery feedback:\n• Go to 'Medical Records'.\n• Find your latest prescription.\n• Click 'Report Your Recovery' and fill in the details.\n• Your doctor will see this in your next visit."
      });
    }

    // 7. ACCOUNT DELETE
    if (msg.includes('delete account') || msg.includes('remove my data')) {
      return res.json({
        success: true,
        reply: "Account Deletion:\n• For legal medical record keeping, you cannot delete your account directly.\n• Please request account closure by contacting the hospital administration.\n• Your doctor must approve the final status of your records."
      });
    }

    // 8. SYSTEM STATUS
    if (msg.includes('report submitted') || msg.includes('summary')) {
      return res.json({
        success: true,
        reply: "System Note:\n• 'Report Submitted' means your doctor has received your feedback.\n• AI summaries are for clinical guidance and may not be visible to patients in all views.\n• Check your 'Medical Records' periodically for updates."
      });
    }

    // 9. FALLBACK
    return res.json({
      success: true,
      reply: "I'm not sure about that. Please contact hospital support or try again."
    });

  } catch (err) {
    console.error('Patient Assistant Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
