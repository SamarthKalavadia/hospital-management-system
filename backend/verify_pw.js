const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function verifyPassword() {
    await mongoose.connect(process.env.MONGO_URI);
    const email = "sanidhyakalavadia@gmail.com";
    const plainPassword = process.argv[2]; // Pass as argument

    if (!plainPassword) {
        console.log("Please provide a password to test.");
        process.exit();
    }

    const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
    if (user) {
        console.log("User found. Comparing...");
        const isMatch = await bcrypt.compare(plainPassword.trim(), user.password);
        console.log("MATCH_RESULT:", isMatch);
    } else {
        console.log("User not found.");
    }
    process.exit();
}

verifyPassword();
