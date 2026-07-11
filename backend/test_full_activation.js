const mongoose = require("mongoose");
const User = require("./models/User");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function testFullActivationFlow() {
    await mongoose.connect(process.env.MONGO_URI);
    const testEmail = "test_activation_flow_123@example.com";
    const testPassword = "MySecurePassword123";

    // Cleanup any existing test user
    await User.deleteOne({ email: testEmail });

    // Step 1: Create inactive user (simulating doctor invite)
    console.log("Step 1: Creating inactive user...");
    const user = new User({
        email: testEmail,
        firstName: "Test",
        role: "patient",
        isAccountActivated: false
    });
    await user.save();
    console.log("  User created. Password hash:", user.password || "NONE");

    // Step 2: Simulate OTP flow - set OTP
    console.log("\nStep 2: Setting OTP...");
    const foundUser = await User.findOne({ email: testEmail });
    foundUser.otp = "123456";
    foundUser.otpExpiry = Date.now() + 10 * 60 * 1000;
    await foundUser.save();
    console.log("  OTP set.");

    // Step 3: Simulate activation (setting password)
    console.log("\nStep 3: Activating with password '" + testPassword + "'...");
    const activatingUser = await User.findOne({ email: testEmail });
    activatingUser.password = testPassword; // Plain text - hook should hash
    activatingUser.isAccountActivated = true;
    activatingUser.otp = undefined;
    activatingUser.otpExpiry = undefined;
    await activatingUser.save();
    console.log("  Activation complete.");

    // Step 4: Check the stored hash
    console.log("\nStep 4: Verifying stored password...");
    const finalUser = await User.findOne({ email: testEmail });
    console.log("  Password hash exists:", !!finalUser.password);
    console.log("  Hash length:", finalUser.password ? finalUser.password.length : 0);
    console.log("  Hash starts with $2b$10$:", finalUser.password ? finalUser.password.startsWith("$2b$10$") : false);

    // Step 5: Verify login would work
    console.log("\nStep 5: Testing password comparison...");
    const isMatch = await bcrypt.compare(testPassword, finalUser.password);
    console.log("  MATCH RESULT:", isMatch);

    if (isMatch) {
        console.log("\n✅ SUCCESS: Activation flow is working correctly!");
    } else {
        console.log("\n❌ FAILURE: Password does not match after activation!");
    }

    // Cleanup
    await User.deleteOne({ email: testEmail });
    console.log("\nTest user cleaned up.");

    process.exit();
}

testFullActivationFlow();
