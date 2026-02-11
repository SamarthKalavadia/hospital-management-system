const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function testActivation() {
    await mongoose.connect(process.env.MONGO_URI);
    const email = "test_activation@example.com";

    // Cleanup
    await User.deleteOne({ email });

    // Create inactive user
    const user = new User({
        email,
        firstName: "Test",
        isAccountActivated: false,
        role: "patient"
    });
    await user.save();
    console.log("Initial user saved (no password)");

    // Activate
    const plainPassword = "password123";
    const foundUser = await User.findOne({ email });
    foundUser.password = plainPassword;
    foundUser.isAccountActivated = true;
    await foundUser.save();
    console.log("User activated with password Assignment");

    // Check
    const checkedUser = await User.findOne({ email });
    const isMatch = await bcrypt.compare(plainPassword, checkedUser.password);
    console.log("PASSWORD_MATCH:", isMatch);

    // Check if it's hashed
    console.log("HASH_START:", checkedUser.password.substring(0, 10));

    await User.deleteOne({ email });
    process.exit();
}

testActivation();
