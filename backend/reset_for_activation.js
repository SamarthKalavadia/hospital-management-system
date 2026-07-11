const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function resetForActivation() {
    await mongoose.connect(process.env.MONGO_URI);
    const email = "sanidhyakalavadia@gmail.com";

    const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });

    if (user) {
        // Remove password so user must go through activation
        user.password = undefined;
        user.isAccountActivated = false;
        user.isGoogleUser = false;
        await user.save();
        console.log("Account reset. User must now activate via OTP to set password.");
    } else {
        console.log("User not found");
    }
    process.exit();
}

resetForActivation();
