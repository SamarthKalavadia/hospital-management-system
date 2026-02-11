const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");

// START GOOGLE LOGIN
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false
  })
);

// CALLBACK
router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", {
    session: false
  }, (err, user, info) => {
    if (err) return next(err);

    // If user not found, redirect to login with a notice so frontend can offer registration
    if (!user) {
      if (info && info.message === "NOT_REGISTERED") {
        const profile = info.profile || {};
        const params = new URLSearchParams();
        // Send user back to login and show a 'no user found' message with a Register button
        params.set("error", "no_user_found");
        params.set("google", "true");
        if (profile.email) params.set("email", profile.email);
        if (profile.name) params.set("name", profile.name);

        return res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5501'}/hospital-management-system/frontend/login.html?${params.toString()}`);
      }

      if (info && info.message === "NOT_A_PATIENT") {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5501'}/hospital-management-system/frontend/login.html?error=not_patient`);
      }

      return res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5501'}/hospital-management-system/frontend/login.html?error=not_registered`);
    }

    const token = jwt.sign({
      id: user._id,
      role: user.role
    }, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    const smallUser = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim()
    };

    const userParam = encodeURIComponent(JSON.stringify(smallUser));
    return res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5501'}/hospital-management-system/frontend/patient-dashboard.html?token=${token}&user=${userParam}`);
  })(req, res, next);
});

// POST /api/auth/send-otp
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.json({ success: false, message: "Email is required" });

    const User = require("../models/User");
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = Date.now() + 10 * 60 * 1000;
    await user.save();

    const sendOtp = require("../utils/sendOtp");
    await sendOtp(email, otp);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  // In JWT, logout is mostly handled client-side by deleting the token.
  // We just return success.
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;
