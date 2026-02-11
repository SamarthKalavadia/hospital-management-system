const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Ensure callback URL exists
if (!process.env.GOOGLE_CALLBACK_URL) {
  console.error("❌ GOOGLE_CALLBACK_URL is not defined in environment variables");
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, // MUST come from Railway env
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;

        if (!email) {
          return done(null, false, { message: "NO_EMAIL_FROM_GOOGLE" });
        }

        const user = await User.findOne({ email });

        // If user not registered, prevent auto creation
        if (!user) {
          return done(null, false, {
            message: "NOT_REGISTERED",
            profile: {
              email: email,
              name: profile.displayName,
            },
          });
        }

        // Only patients allowed
        if (user.role && user.role !== "patient") {
          return done(null, false, { message: "NOT_A_PATIENT" });
        }

        // Mark as Google user if first time
        if (!user.isGoogleUser) {
          user.isGoogleUser = true;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Google OAuth Error:", err);
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
