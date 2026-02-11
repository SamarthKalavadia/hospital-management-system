const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;

        const user = await User.findOne({ email });

        if (!user) {
          // Do not auto-create users via Google; pass profile so caller can redirect to register
          return done(null, false, {
            message: "NOT_REGISTERED",
            profile: {
              email: profile.emails && profile.emails[0] && profile.emails[0].value,
              name: profile.displayName
            }
          });
        }

        // Only allow patients to log in via Google
        if (user.role && user.role !== "patient") {
          return done(null, false, { message: "NOT_A_PATIENT" });
        }

        // mark that this account is a Google user (persist)
        if (!user.isGoogleUser) {
          user.isGoogleUser = true;
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const u = await User.findById(id);
    done(null, u);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
