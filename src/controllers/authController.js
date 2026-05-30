const User = require("../models/User");
const { generateToken } = require("../middleware/auth");

// ── Helper: format user response (tanpa password) ─────────────────────────────
const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  bio: user.bio,
  pantryCount: user.pantry?.length || 0,
  preferences: user.preferences,
  createdAt: user.createdAt,
  lovedRecipes: (user.lovedRecipes || []).map((id) => String(id)),
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validasi input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Nama, email, dan password wajib diisi.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password minimal 6 karakter.",
      });
    }

    // Cek email sudah terdaftar
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email sudah terdaftar. Silakan gunakan email lain atau login.",
      });
    }

    // Buat user baru
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: "Registrasi berhasil! Selamat datang di OLAH.",
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email sudah terdaftar.",
      });
    }
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat registrasi.",
    });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email dan password wajib diisi.",
      });
    }

    // Cari user + ambil password (select: false di schema)
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
    }

    // Bandingkan password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Email atau password salah.",
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: `Selamat datang kembali, ${user.name}!`,
      data: {
        user: formatUser(user),
        token,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat login.",
    });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User tidak ditemukan.",
      });
    }

    res.status(200).json({
      success: true,
      data: { user: formatUser(user) },
    });
  } catch (error) {
    console.error("getMe error:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan.",
    });
  }
};

// ── PUT /api/auth/change-password ─────────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Password lama dan baru wajib diisi.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password baru minimal 6 karakter.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Password lama salah.",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password berhasil diubah.",
    });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
};

const crypto = require("crypto");
const { sendOtpEmail } = require("../utils/mailer");

// ── POST /api/auth/forgot-password ────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email wajib diisi." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    // Selalu response sukses agar tidak bocorkan info email terdaftar atau tidak
    if (!user) {
      return res.status(200).json({ success: true, message: "Jika email terdaftar, OTP telah dikirim." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.passwordResetOtp = crypto.createHash("sha256").update(otp).digest("hex");
    user.passwordResetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({ success: true, message: "OTP telah dikirim ke email." });
  } catch (error) {
    console.error("forgotPassword error:", error);
    res.status(500).json({ success: false, message: "Gagal mengirim OTP." });
  }
};

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordResetOtp");

    if (!user || !user.passwordResetOtpExpiry || user.passwordResetOtpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: "OTP sudah kadaluarsa." });
    }

    const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedInput !== user.passwordResetOtp) {
      return res.status(400).json({ success: false, message: "Kode OTP salah atau sudah kadaluarsa." });
    }

    res.status(200).json({ success: true, message: "OTP valid." });
  } catch (error) {
    console.error("verifyOtp error:", error);
    res.status(500).json({ success: false, message: "Gagal verifikasi OTP." });
  }
};

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password +passwordResetOtp");

    if (!user || !user.passwordResetOtpExpiry || user.passwordResetOtpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: "OTP sudah kadaluarsa. Ulangi prosesnya." });
    }

    const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedInput !== user.passwordResetOtp) {
      return res.status(400).json({ success: false, message: "OTP tidak valid." });
    }

    user.password = newPassword;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpiry = null;
    await user.save();

    res.status(200).json({ success: true, message: "Kata sandi berhasil direset." });
  } catch (error) {
    console.error("resetPassword error:", error);
    res.status(500).json({ success: false, message: "Gagal mereset kata sandi." });
  }
};

module.exports = { register, login, getMe, changePassword, forgotPassword, verifyOtp, resetPassword };
