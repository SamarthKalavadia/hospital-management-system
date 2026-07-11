const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true, required: true },
  age: Number,
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  phone: String,
  password: String,
  role: { type: String, enum: ["patient", "doctor"], default: "patient" },
  isGoogleUser: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Number,
  isVerified: { type: Boolean, default: false },
  isPlaceholderEmail: { type: Boolean, default: false },
  // accountStatus: PENDING, INVITED, VERIFIED, ACTIVE
  status: { type: String, enum: ['PENDING', 'INVITED', 'VERIFIED', 'ACTIVE'], default: 'PENDING' },
  activationToken: String,
  activationTokenExpiry: Number
});

// Hash password before save (only if modified and not a Google user)
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (!this.password) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", UserSchema);
