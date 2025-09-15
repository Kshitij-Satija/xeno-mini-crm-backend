const express = require("express");
const passport = require("passport");
const { loginSuccess, logoutUser } = require("../controllers/auth.controller");

const FRONTEND_URI = process.env.FRONTEND_URI;

const router = express.Router();

// Google login
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URI}/login` }),
  (req, res) => {
    console.log("✅ Google OAuth callback hit");
    console.log("🔑 req.user:", req.user);
    console.log("📝 req.session after login:", req.session);

    // At this point, req.user should be populated and stored in session.
    // If you don't see req.user here, passport's serializeUser is not being called.

    res.redirect(`${FRONTEND_URI}/dashboard`);
  }
);

// Current logged-in user
router.get("/me", loginSuccess);

// Logout
router.get("/logout", logoutUser);

// Debug route - check session directly
router.get("/debug-session", (req, res) => {
  res.json({
    session: req.session,
    user: req.user,
  });
});

module.exports = router;
