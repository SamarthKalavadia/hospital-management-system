const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function resetUser() {
    await mongoose.connect(process.env.MONGO_URI);
    const email = "sanidhyakalavadia@gmail.com";
    const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });

    if (user) {
        user.password = "123456"; // Plain text
        user.isAccountActivated = true;
        user.isVerified = true;
        user.isGoogleUser = false;
        await user.save(); // Hook should hash it
        console.log("Password reset successfully to 123456");
    } else {
        console.log("User not found");
    }
    process.exit();
}

resetUser();
