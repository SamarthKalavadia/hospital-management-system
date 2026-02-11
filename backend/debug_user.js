const mongoose = require("mongoose");
const User = require("./models/User");
require("dotenv").config();

async function checkUser() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = "sanidhyakalavadia@gmail.com";
        const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
        if (user) {
            console.log("DEBUG_START");
            console.log("FOUND_EMAIL:" + user.email);
            console.log("FOUND_ROLE:" + user.role);
            console.log("ID:" + user._id);
            console.log("PW_LEN:" + (user.password ? user.password.length : 0));
            console.log("PW_START:" + (user.password ? user.password.substring(0, 10) : "NONE"));
            console.log("IS_GOOGLE:" + user.isGoogleUser);
            console.log("IS_ACT:" + user.isAccountActivated);
            console.log("DEBUG_END");
        } else {
            console.log("USER_NOT_FOUND");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

checkUser();
