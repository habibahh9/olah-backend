// ── routes/auth.js ────────────────────────────────────────────────────────────
const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  changePassword,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const { forgotPassword, verifyOtp, resetPassword } = require("../controllers/authController");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getMe);
router.put("/change-password", protect, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOtp);
router.post("/reset-password", resetPassword);

module.exports = router;
