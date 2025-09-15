const express = require("express");
const passport = require("passport");
const { loginSuccess, logoutUser } = require("../controllers/auth.controller");

const FRONTEND_URI = process.env.FRONTEND_URI;

const router = express.Router();

// Google login
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${FRONTEND_URI}/login` }),
  (req, res) => {
    res.redirect(`${FRONTEND_URI}/dashboard`);
  }
);

router.get("/me", loginSuccess);
router.get("/logout", logoutUser);

module.exports = router;
