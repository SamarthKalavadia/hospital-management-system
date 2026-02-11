const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

// PATCH /api/patient/profile
router.patch("/profile", auth, async (req, res) => {
  try {
    const { firstName, lastName, phone, age, gender } = req.body;
    
    // Validate gender if present
    if (gender && !["male", "female", "other"].includes(gender.toLowerCase())) {
      return res.json({ success: false, message: "Invalid gender" });
    }

    // Validate age if present
    if (age !== undefined && (isNaN(age) || Number(age) < 0)) {
      return res.json({ success: false, message: "Age cannot be negative" });
    }

    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone) updateData.phone = phone;
    if (age !== undefined) updateData.age = age;
    if (gender) updateData.gender = gender.toLowerCase();

    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select("-password");
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
