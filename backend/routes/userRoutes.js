const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require('fs');
const path = require('path');
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const Prescription = require("../models/Prescription");
const auth = require('../middleware/auth');

const router = express.Router();

// REGISTER (patients)
router.post("/register", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      age,
      gender
    } = req.body;

    // server-side validation for gender
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.json({
        success: false,
        message: 'Invalid gender'
      });
    }

    // Validate non-negative age
    if (age !== undefined && (isNaN(age) || Number(age) < 0)) {
      return res.json({
        success: false,
        message: 'Age cannot be negative'
      });
    }

    if (!firstName || !email) {
      return res.json({
        success: false,
        message: "Missing required fields"
      });
    }

    let existing = await User.findOne({
      email
    });
    if (existing) {
      return res.json({
        success: false,
        message: "User already exists"
      });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      age: age || undefined,
      gender: gender || undefined,
      password: password || undefined,
      role: "patient",
      isGoogleUser: !password
    });

    await user.save();

    // If registered via Google (no password), issue token immediately
    if (user.isGoogleUser) {
      const token = jwt.sign({
        id: user._id,
        role: user.role
      }, process.env.JWT_SECRET, {
        expiresIn: "7d"
      });
      return res.json({
        success: true,
        message: "User registered",
        token,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role
        }
      });
    }

    res.json({
      success: true,
      message: "User registered",
      user: {
        _id: user._id,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// REGISTER INIT: create user record with OTP and send OTP to email
router.post("/register-init", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      age,
      gender
    } = req.body;

    // server-side validation for gender
    if (gender && !['male', 'female', 'other'].includes(gender)) {
      return res.json({
        success: false,
        message: 'Invalid gender'
      });
    }

    // Validate non-negative age
    if (age !== undefined && (isNaN(age) || Number(age) < 0)) {
      return res.json({
        success: false,
        message: 'Age cannot be negative'
      });
    }

    if (!firstName || !email || !phone) {
      return res.json({
        success: false,
        message: "Missing required fields"
      });
    }

    let existing = await User.findOne({
      email
    });
    if (existing) {
      return res.json({
        success: false,
        message: "User already exists"
      });
    }

    // generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes

    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      age: age || undefined,
      gender: gender || undefined,
      password: password || undefined,
      role: "patient",
      isGoogleUser: !password,
      otp,
      otpExpiry,
      isVerified: false
    });

    await user.save();

    // 1. Send immediate success response after saving patient record to DB
    res.json({
      success: true,
      message: "Patient record created. OTP is being sent to your email.",
      email: user.email
    });

    // 2. Execute background task for OTP email
    (async () => {
      try {
        const sendOtp = require("../utils/sendOtp");
        await sendOtp(email, otp);
      } catch (e) {
        console.error(`[BG_TASK_ERROR] Failed to send OTP email to ${email}:`, e);
      }
    })();
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// VERIFY OTP and finalize registration
router.post("/verify-otp", async (req, res) => {
  try {
    const {
      email,
      otp
    } = req.body;
    if (!email || !otp) return res.json({
      success: false,
      message: "Missing fields"
    });

    const user = await User.findOne({
      email
    });
    if (!user) return res.json({
      success: false,
      message: "User not found"
    });

    if (!user.otp || !user.otpExpiry) return res.json({
      success: false,
      message: "No OTP requested"
    });

    if (Date.now() > user.otpExpiry) return res.json({
      success: false,
      message: "OTP expired"
    });

    if (user.otp !== otp) return res.json({
      success: false,
      message: "Invalid OTP"
    });

    // OTP correct => mark verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    // issue token
    const token = jwt.sign({
      id: user._id,
      role: user.role
    }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({
      success: true,
      message: "Verified",
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// RESEND OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const {
      email
    } = req.body;
    if (!email) return res.json({
      success: false,
      message: "Email required"
    });

    const user = await User.findOne({
      email
    });
    if (!user) return res.json({
      success: false,
      message: "User not found"
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 5 * 60 * 1000;
    await user.save();

    try {
      const sendOtp = require("../utils/sendOtp");
      await sendOtp(email, otp);
    } catch (e) {
      console.error("Failed to send OTP:", e);
    }

    res.json({
      success: true,
      message: "OTP resent"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const {
      email,
      password,
      role
    } = req.body;

    // 🔐 Role is REQUIRED
    if (!role) {
      return res.json({
        success: false,
        message: "Role is required"
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      email: {
        $regex: new RegExp(`^${normalizedEmail}$`, 'i')
      },
      role
    });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found. Please ensure you are logging in with the correct role."
      });
    }

    // 🚫 If only Google login is available (no password set)
    if (user.isGoogleUser && !user.password) {
      return res.json({
        success: false,
        message: "Please login using Google. If you want to use a password, please activate your account first."
      });
    }

    // 🔒 Enforce Activation for Patients
    if (user.role === 'patient') {
      if (user.status !== 'ACTIVE') {
        let msg = "Account access not activated. Please contact hospital staff.";
        if (user.status === 'INVITED' || user.status === 'VERIFIED') {
          msg = "Account not fully setup. Please check your email for the activation link.";
        }
        return res.json({ success: false, message: msg });
      }
    }

    console.log(`[LOGIN_DEBUG] Email: ${normalizedEmail}, Role: ${role}`);
    console.log(`[LOGIN_DEBUG] User found: ${!!user}`);
    if (user) {
      console.log(`[LOGIN_DEBUG] DB Hash exists: ${!!user.password}`);
      console.log(`[LOGIN_DEBUG] DB Hash start: ${user.password ? user.password.substring(0, 10) : 'NONE'}`);
      console.log(`[LOGIN_DEBUG] Input password length: ${password.trim().length}`);
    }

    const isMatch = await bcrypt.compare(password.trim(), user.password);
    console.log(`[LOGIN_DEBUG] Password match: ${isMatch}`);

    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials. Please check your password." });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        email: user.email,
        role: user.role,
        lastName: user.lastName,
        phone: user.phone,
        age: user.age,
        gender: user.gender
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// UPDATE user (by id)
router.put('/:id', async (req, res) => {
  try {
    const update = req.body;
    // validate gender if present
    if (update.gender && !['male', 'female', 'other'].includes(update.gender)) {
      return res.json({ success: false, message: 'Invalid gender' });
    }
    // prevent changing email to existing one
    if (update.email) delete update.email;
    // if password provided, it will be hashed by the pre-save hook
    if (update.password) {
      // update.password = update.password (leave as plain text for hook)
    }
    // allow updating gender and age as well
    const allowed = {};
    ['firstName', 'lastName', 'phone', 'age', 'gender', 'password', 'isVerified'].forEach(k => {
      if (update[k] !== undefined) allowed[k] = update[k];
    });
    if (update.password) allowed.password = update.password;
    const u = await User.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!u) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: u });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE user
router.delete('/:id', auth, async (req, res) => {
  try {
    // Only doctors or admins can delete patients
    if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const patientId = req.params.id;
    const user = await User.findById(patientId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    if (user.role !== 'patient') {
      return res.status(400).json({ success: false, message: 'Only patient records can be deleted this way' });
    }

    // Cascade Delete related data will handle appointments regardless of status

    // 1. Find all prescriptions to delete PDFs
    const prescriptions = await Prescription.find({ patientId: patientId });
    for (const p of prescriptions) {
      if (p.pdfPath && fs.existsSync(p.pdfPath)) {
        try {
          fs.unlinkSync(p.pdfPath);
        } catch (e) {
          console.error(`Failed to delete PDF at ${p.pdfPath}:`, e);
        }
      }
    }

    // 2. Cascade Delete related data
    await Appointment.deleteMany({ patientId: patientId });
    await Prescription.deleteMany({ patientId: patientId });

    // 3. Delete the Patient User record
    await User.findByIdAndDelete(patientId);

    res.json({ success: true, message: 'Patient deleted permanently' });
  } catch (err) {
    console.error('Delete Patient Error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// search patients (protected)
router.get('/search', auth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    // only allow doctors or admins to search patients
    if (!req.user || (req.user.role !== 'doctor' && req.user.role !== 'admin')) return res.status(403).json({ success: false, message: 'Forbidden' });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await require('../models/User').find({
      role: 'patient',
      $or: [{ firstName: regex }, { lastName: regex }, { email: regex }, { phone: regex }]
    }).limit(12).select('firstName lastName phone email isAccountActivated');
    res.json(users.map(u => ({
      id: u._id,
      name: (u.firstName || '') + (u.lastName ? (' ' + u.lastName) : ''),
      phone: u.phone,
      email: u.email,
      isAccountActivated: u.isAccountActivated
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// --- ACTIVATION ROUTES ---

// 1. INVITE PATIENT (Doctor Action)
// 1. INVITE / CREATE PATIENT (Doctor Action)
router.post("/invite", auth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { firstName, lastName, email, phone, age, gender } = req.body;

    let finalEmail = email;
    let isPlaceholder = false;

    if (!finalEmail) {
      isPlaceholder = true;
      const crypto = require('crypto');
      const tempId = crypto.randomBytes(3).toString('hex').toUpperCase();
      finalEmail = `patient_${tempId}@hospital.local`;
    }

    let user = await User.findOne({ email: finalEmail });
    if (user) {
      if (user.status === 'ACTIVE') {
        return res.json({ success: false, message: "User already active" });
      }
      return res.json({ success: false, message: "User record already exists" });
    }

    // Create new user
    user = new User({
      firstName, lastName, 
      email: finalEmail, 
      phone, age, gender,
      role: 'patient',
      isPlaceholderEmail: isPlaceholder,
      status: isPlaceholder ? 'PENDING' : 'INVITED'
    });

    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    user.activationToken = token;
    user.activationTokenExpiry = Date.now() + 24 * 3600 * 1000; // 24h

    await user.save();

    // 1. Send immediate success response after saving to database
    res.json({ 
      success: true, 
      message: isPlaceholder ? "Patient created with placeholder email" : "Patient created successfully. Invitation is being sent.",
      user: { id: user._id, email: user.email }
    });

    // 2. Execute background tasks (emails, etc.) AFTER response is sent to improve performance
    if (!isPlaceholder) {
      const host = req.headers.host; // Capture host from request object
      // Wrapped in non-blocking async scope
      (async () => {
        try {
          const sendActivation = require('../utils/sendActivation');
          await sendActivation(finalEmail, token, host);
        } catch (e) {
          console.error(`[BG_TASK_ERROR] Failed to send activation email to ${finalEmail}:`, e);
        }
      })();
    }

  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: UPDATE PATIENT EMAIL / ACTIVATE ACCOUNT
router.put("/update-email/:id", auth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Valid email required" });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "Patient not found" });

    // Validate new email format
    if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
       return res.json({ success: false, message: "Invalid email format" });
    }

    // Reject if email exists
    const existing = await User.findOne({ email });
    if (existing) return res.json({ success: false, message: "Email already exists in database" });

    // Reject if equals placeholder format (patient_xxxxxx@hospital.local)
    if (email.toLowerCase().endsWith("@hospital.local") && email.toLowerCase().startsWith("patient_")) {
        return res.json({ success: false, message: "Invalid email format" });
    }

    user.email = email;
    user.isPlaceholderEmail = false;
    user.status = 'INVITED';

    // Generate activation token so they can set password
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    user.activationToken = token;
    user.activationTokenExpiry = Date.now() + 24 * 3600 * 1000; // 24h

    await user.save();

    // 1. Send immediate success response
    res.json({ 
      success: true, 
      message: "Patient email updated. Invitation is being sent.",
      user: { id: user._id, email: user.email }
    });

    // 2. Send invitation email in background (non-blocking)
    (async () => {
      try {
        const sendActivation = require('../utils/sendActivation');
        await sendActivation(email, token, req.headers.host);
      } catch (e) {
        console.error(`[BG_TASK_ERROR] Failed to send activation email to ${email}:`, e);
      }
    })();

  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. RESEND ACTIVATION (Doctor Action - Token Based re-send)
router.post("/resend-activation", auth, async (req, res) => {
  try {
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') return res.status(403).json({ success: false });
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.status === 'ACTIVE') return res.json({ success: false, message: "Already active" });

    // Generate Token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    user.activationToken = token;
    user.activationTokenExpiry = Date.now() + 24 * 3600 * 1000;
    await user.save();

    // 1. Send immediate success response
    res.json({ success: true, message: "Activation email is being resent" });

    // 2. Send activation email in background (non-blocking)
    (async () => {
      try {
        const sendActivation = require('../utils/sendActivation');
        await sendActivation(email, token, req.headers.host);
      } catch (e) {
        console.error(`[BG_TASK_ERROR] Failed to resend activation email to ${email}:`, e);
      }
    })();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// NEW: SEND ACTIVATION OTP (Patient Action)
router.post("/send-activation-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "No patient record found. Please contact hospital staff." });
    
    if (user.status === 'ACTIVE') return res.json({ success: false, message: "Account already activated. Please login." });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    // 1. Send immediate success response
    res.json({ success: true, message: "OTP is being sent to your email." });

    // 2. Send OTP email in background (non-blocking)
    (async () => {
      try {
        const sendOtp = require("../utils/sendOtp");
        await sendOtp(email, otp);
      } catch (e) {
        console.error(`[BG_TASK_ERROR] Failed to send activation OTP to ${email}:`, e);
      }
    })();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2.5 VERIFY ACTIVATION TOKEN
router.get("/verify-activation", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: "Token missing" });

    const user = await User.findOne({
      activationToken: token,
      activationTokenExpiry: { $gt: Date.now() }
    });

    if (!user) return res.json({ success: false, message: "Invalid or expired activation link" });

    if (user.status === 'ACTIVE') {
      return res.json({ success: false, message: "Account already activated", alreadyActive: true });
    }

    res.json({ 
      success: true, 
      message: "Token valid", 
      email: user.email,
      status: user.status
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2.6 VERIFY OTP (Transition to VERIFIED)
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, token, otp } = req.body;
    let user;

    if (token) {
      user = await User.findOne({ email, activationToken: token, activationTokenExpiry: { $gt: Date.now() } });
    } else {
      user = await User.findOne({ email });
    }

    if (!user) return res.json({ success: false, message: "User not found" });

    if (!user.otp || !user.otpExpiry || Date.now() > user.otpExpiry || user.otp !== otp) {
      return res.json({ success: false, message: "Invalid or expired OTP" });
    }

    user.status = 'VERIFIED';
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: "OTP verified. Please set your password." });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2.7 SET PASSWORD (Transition to ACTIVE)
router.post("/set-password", async (req, res) => {
  try {
    const { email, token, password } = req.body;
    let user;

    if (token) {
      user = await User.findOne({ email, activationToken: token, activationTokenExpiry: { $gt: Date.now() } });
    } else {
      user = await User.findOne({ email });
    }

    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.status !== 'VERIFIED' && user.status !== 'INVITED') {
        // We allow INVITED if they bypassed OTP somehow but rule says check VERIFIED
        // Actually follow the rules: if (status === VERIFIED)
        if (user.status !== 'VERIFIED') return res.json({ success: false, message: "Please verify OTP first." });
    }

    user.password = password;
    user.status = 'ACTIVE';
    user.activationToken = undefined;
    user.activationTokenExpiry = undefined;
    user.isVerified = true;

    await user.save();

    res.json({ success: true, message: "Account activated successfully. You may now login." });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 3. ACTIVATE ACCOUNT (Single Step fallback)
router.post("/activate", async (req, res) => {
  try {
    const { email, token, otp, password } = req.body;
    let user;

    if (token) {
      user = await User.findOne({
        email,
        activationToken: token,
        activationTokenExpiry: { $gt: Date.now() }
      });
    } else if (otp) {
      user = await User.findOne({ email });
      if (user && (user.otp !== otp || Date.now() > user.otpExpiry)) user = null;
    }

    if (!user) return res.json({ success: false, message: "Invalid or expired activation details." });

    if (user.status === 'ACTIVE') return res.json({ success: false, message: "Account already active" });

    user.password = password;
    user.status = 'ACTIVE';
    user.activationToken = undefined;
    user.activationTokenExpiry = undefined;
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;

    await user.save();

    res.json({ success: true, message: "Account activated successfully." });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --- SECURE PROFILE ROUTES (In-Dashboard) ---

// 1. Request OTP for Password Change
router.post("/profile/request-otp", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    // 1. Send immediate success response
    res.json({ success: true, message: "OTP is being sent to your email" });

    // 2. Send OTP email in background (non-blocking)
    (async () => {
      try {
        const sendOtp = require("../utils/sendOtp");
        await sendOtp(user.email, otp);
      } catch (e) {
        console.error(`[BG_TASK_ERROR] Failed to send profile OTP to ${user.email}:`, e);
      }
    })();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. Verify OTP for Password Change
router.post("/profile/verify-otp", auth, async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (!user.otp || !user.otpExpiry || Date.now() > user.otpExpiry || user.otp !== otp) {
      return res.json({ success: false, message: "Invalid or expired OTP" });
    }

    res.json({ success: true, message: "OTP verified" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 3. Update Password (Direct)
router.post("/profile/update-password", auth, async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user || user.otp !== otp) {
      return res.json({ success: false, message: "Session expired. Please request a new OTP." });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: "Password updated successfully" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// PUBLIC FORGOT PASSWORD
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email required" });

    const user = await User.findOne({ email });
    if (!user) {
      // Security: Don't reveal user existence, but for now helpful message
      return res.json({ success: false, message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    // 1. Send immediate success response
    res.json({ success: true, message: "OTP is being sent to your email" });

    // 2. Send OTP email in background (non-blocking)
    (async () => {
      try {
        const sendOtp = require("../utils/sendOtp");
        await sendOtp(user.email, otp);
      } catch (e) {
        console.error(`[BG_TASK_ERROR] Failed to send forgot-password OTP to ${user.email}:`, e);
      }
    })();
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUBLIC RESET PASSWORD
router.post("/reset-password-public", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.json({ success: false, message: "Missing fields" });

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    if (!user.otp || !user.otpExpiry || Date.now() > user.otpExpiry || user.otp !== otp) {
      return res.json({ success: false, message: "Invalid or expired OTP" });
    }

    user.password = newPassword;
    user.otp = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET user by ID (Generic - Keep at bottom)
router.get('/:id', auth, async (req, res) => {
  try {
    if (!require('mongoose').Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid User ID format' });
    }
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
