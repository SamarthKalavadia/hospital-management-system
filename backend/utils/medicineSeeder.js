const Medicine = require('../models/Medicine');

const MASTER_MEDICINES = [
  // TABLETS / VATI
  { name: 'Sudarshan Ghan Vati', category: 'tablet', dose: '2 tablets', duration: 7, instructions: 'thrice daily' },
  { name: 'Tribhuvan Kirti Rasa', category: 'tablet', dose: '125mg', duration: 5, instructions: 'twice daily' },
  { name: 'Sanjeevani Vati', category: 'tablet', dose: '1 tablet', duration: 7, instructions: 'twice daily' },
  { name: 'Giloy Ghan Vati', category: 'tablet', dose: '1 tablet', duration: 15, instructions: 'twice daily' },
  { name: 'Arogyavardhini Vati', category: 'tablet', dose: '2 tablets', duration: 21, instructions: 'twice daily' },
  { name: 'Chandraprabha Vati', category: 'tablet', dose: '2 tablets', duration: 30, instructions: 'twice daily' },
  { name: 'Kaishore Guggulu', category: 'tablet', dose: '2 tablets', duration: 30, instructions: 'twice daily' },
  { name: 'Yograj Guggulu', category: 'tablet', dose: '2 tablets', duration: 30, instructions: 'twice daily' },
  { name: 'Hingwashtak Vati', category: 'tablet', dose: '1 tablet', duration: 15, instructions: 'after meals' },

  // ASAVA / ARISHTA
  { name: 'Amritarishta', category: 'asava', dose: '20ml', duration: 14, instructions: 'after meals' },
  { name: 'Dashmoolarishta', category: 'asava', dose: '20ml', duration: 30, instructions: 'after meals' },
  { name: 'Ashokarishta', category: 'asava', dose: '20ml', duration: 30, instructions: 'after meals' },
  { name: 'Draksharishta', category: 'asava', dose: '20ml', duration: 30, instructions: 'after meals' },
  { name: 'Balarishta', category: 'asava', dose: '20ml', duration: 30, instructions: 'after meals' },
  { name: 'Kutajarishta', category: 'asava', dose: '20ml', duration: 15, instructions: 'after meals' },
  { name: 'Abhayarishta', category: 'asava', dose: '15-30ml', duration: 30, instructions: 'after meals' },

  // CHURNA
  { name: 'Triphala Churna', category: 'churna', dose: '3-5g', duration: 30, instructions: 'at bedtime with warm water' },
  { name: 'Sitopaladi Churna', category: 'churna', dose: '3g', duration: 14, instructions: 'twice daily with honey' },
  { name: 'Trikatu Churna', category: 'churna', dose: '1-3g', duration: 14, instructions: 'twice daily' },
  { name: 'Avipattikar Churna', category: 'churna', dose: '3-5g', duration: 21, instructions: 'before meals' },
  { name: 'Hingwashtak Churna', category: 'churna', dose: '3-5g', duration: 15, instructions: 'twice daily' },

  // OILS / TAILA
  { name: 'Ksheerabala Taila', category: 'oil', dose: '--', duration: 30, instructions: 'external application' },
  { name: 'Mahanarayan Taila', category: 'oil', dose: '--', duration: 30, instructions: 'external application' },
  { name: 'Dhanwantharam Taila', category: 'oil', dose: '--', duration: 30, instructions: 'external application' },
  { name: 'Bala Taila', category: 'oil', dose: '--', duration: 30, instructions: 'external application' },
  { name: 'Sahacharadi Taila', category: 'oil', dose: '--', duration: 30, instructions: 'external application' },

  // SYRUPS / OTHERS
  { name: 'Chyawanprash', category: 'syrup', dose: '10g', duration: 30, instructions: 'twice daily with milk' },
  { name: 'Swasamrutham Syrup', category: 'syrup', dose: '10ml', duration: 14, instructions: 'thrice daily' },
  { name: 'Vasavaleha', category: 'others', dose: '5-10g', duration: 21, instructions: 'twice daily' },
  { name: 'Kantakari Avaleha', category: 'others', dose: '5-10g', duration: 21, instructions: 'twice daily' },
  { name: 'Brahmi Ghrita', category: 'others', dose: '5-10g', duration: 30, instructions: 'with warm milk' }
];

/**
 * Seed a single medicine if it doesn't exist
 */
async function seedMedicine(med) {
  try {
    const existing = await Medicine.findOne({ 
      name: { $regex: new RegExp(`^${med.name.trim()}$`, 'i') } 
    });

    if (!existing) {
      // Create with realistic stock 10-100 units
      const initialStock = Math.floor(Math.random() * 91) + 10; 
      await Medicine.create({
        name: med.name,
        category: med.category || 'others',
        quantity: initialStock,
        alertLevel: 5,
        defaultDosage: med.dose,
        defaultDuration: med.duration,
        defaultInstructions: med.instructions,
        minStockThreshold: 5,
        isActive: true,
        source: 'SYSTEM_SEEDED'
      });
      console.log(`[SEEDER] Created: ${med.name} (Stock: ${initialStock})`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`[SEEDER] Error seeding ${med.name}:`, error);
    return false;
  }
}

/**
 * Run master seed for all predefined medicines
 */
async function runMasterSeed() {
  console.log('[SEEDER] Starting inventory master seed...');
  let count = 0;
  for (const med of MASTER_MEDICINES) {
    const created = await seedMedicine(med);
    if (created) count++;
  }
  console.log(`[SEEDER] Master seed complete. Added ${count} new medicines to inventory.`);
}

module.exports = {
  seedMedicine,
  runMasterSeed,
  MASTER_MEDICINES
};
