const mongoose = require("mongoose");

const MedicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  manufacturer: String,
  category: {
    type: String,
    enum: ["tablet", "asava", "oil", "churna", "syrup", "liquids", "tablets", "others"],
    default: "others",
  },
  quantity: { type: Number, default: 0 },
  alertLevel: { type: Number, default: 5 },
  defaultDosage: String,
  defaultDuration: Number,
  defaultInstructions: String,
  minStockThreshold: { type: Number, default: 5 },
  isActive: { type: Boolean, default: true },
  source: { type: String, default: "MANUAL" },
});

module.exports = mongoose.model("Medicine", MedicineSchema);
