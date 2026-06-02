const User = require("../models/User");
const Recipe = require("../models/Recipe");
const crypto = require("crypto");
const { sendOtpEmail } = require("../utils/mailer");

// ── GET /api/users/profile ────────────────────────────────────────────────────
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("lovedRecipes", "recipeName category loveCount imageUrl");

    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          preferences: user.preferences,
          pantryCount: user.pantry.length,
          lovedRecipes: user.lovedRecipes,
          lovedCount: user.lovedRecipes.length,
          historyCount: user.history.length,
          shoppingListCount: user.shoppingList.length,
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil profil." });
  }
};

// ── PUT /api/users/profile ────────────────────────────────────────────────────
const updateProfile = async (req, res) => {
  try {
    const { name, bio, avatar, preferences } = req.body;

    const allowedUpdates = {};
    if (name && name.trim()) allowedUpdates.name = name.trim();
    if (bio !== undefined) allowedUpdates.bio = bio.trim();
    if (avatar !== undefined) allowedUpdates.avatar = avatar;
    if (preferences) allowedUpdates.preferences = preferences;

    if (Object.keys(allowedUpdates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada data yang diperbarui.",
      });
    }

    const user = await User.findByIdAndUpdate(req.user._id, allowedUpdates, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      success: true,
      message: "Profil berhasil diperbarui.",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          bio: user.bio,
          preferences: user.preferences,
        },
      },
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui profil." });
  }
};

// ── GET /api/users/history ────────────────────────────────────────────────────
const getHistory = async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;
    const limitNum = Math.min(50, parseInt(limit));
    const pageNum = Math.max(1, parseInt(page));
    const skip = (pageNum - 1) * limitNum;

    const user = await User.findById(req.user._id)
      .select("history")
      .populate({
        path: "history.recipeId",
        select: "recipeName category ingredients totalIngredients cookTime servings loveCount imageUrl",
      });

    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    // Urutkan dari yang terbaru
    const sortedHistory = [...user.history].reverse();
    const total = sortedHistory.length;
    const paginated = sortedHistory.slice(skip, skip + limitNum);

    res.status(200).json({
      success: true,
      data: {
        history: paginated,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error("getHistory error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil riwayat." });
  }
};

// ── POST /api/users/history ───────────────────────────────────────────────────
// Tambah resep ke riwayat dengan cookedAt timestamp
const addHistory = async (req, res) => {
  try {
    const { recipeId } = req.body;
    if (!recipeId) {
      return res.status(400).json({ success: false, message: "recipeId wajib diisi." });
    }

    const recipe = await Recipe.findById(recipeId);
    if (!recipe) {
      return res.status(404).json({ success: false, message: "Resep tidak ditemukan." });
    }

    const user = await User.findById(req.user._id);

    // ── Cek duplikat: resep yang sama dalam 1 menit terakhir ──
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const isDuplicate = user.history.some(
      (h) =>
        String(h.recipeId) === String(recipeId) &&
        h.cookedAt &&
        new Date(h.cookedAt) > oneMinuteAgo
    );

    if (isDuplicate) {
      return res.status(200).json({
        success: true,
        message: "Riwayat sudah ada (duplikat diabaikan).",
        data: { historyItem: null },
      });
    }
    // ─────────────────────────────────────────────────────────

    user.history.push({
      recipeId,
      recipeName: recipe.recipeName,
      cooked: true,
      cookedAt: new Date(),
    });
    await user.save();

    res.status(201).json({
      success: true,
      message: "Riwayat berhasil ditambahkan.",
      data: { historyItem: user.history[user.history.length - 1] },
    });
  } catch (error) {
    console.error("addHistory error:", error);
    res.status(500).json({ success: false, message: "Gagal menambahkan riwayat." });
  }
};

// ── DELETE /api/users/history ─────────────────────────────────────────────────
const clearHistory = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { history: [] } });
    res.status(200).json({
      success: true,
      message: "Riwayat berhasil dihapus.",
    });
  } catch (error) {
    console.error("clearHistory error:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus riwayat." });
  }
};

// ── GET /api/users/loved-recipes ──────────────────────────────────────────────
const getLovedRecipes = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("lovedRecipes")
      .populate("lovedRecipes", "recipeName category ingredients totalIngredients loveCount imageUrl url");

    res.status(200).json({
      success: true,
      data: {
        lovedRecipes: user.lovedRecipes,
        total: user.lovedRecipes.length,
      },
    });
  } catch (error) {
    console.error("getLovedRecipes error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil resep favorit." });
  }
};

// ── PATCH /api/users/history/:historyId/cooked ───────────────────────────────
// Tandai resep di history sebagai sudah dimasak
const markAsCooked = async (req, res) => {
  try {
    const { historyId } = req.params;

    const user = await User.findById(req.user._id).select("history");
    const historyItem = user.history.id(historyId);

    if (!historyItem) {
      return res.status(404).json({ success: false, message: "Riwayat tidak ditemukan." });
    }

    historyItem.cooked = true;
    historyItem.cookedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Resep ditandai sudah dimasak!",
      data: { historyItem },
    });
  } catch (error) {
    console.error("markAsCooked error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
};

// ── POST /api/users/request-otp ──────────────────────────────────────────────
const requestOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+passwordResetOtp");
    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    user.passwordResetOtp = crypto.createHash("sha256").update(otp).digest("hex");
    user.passwordResetOtpExpiry = expiry;
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({
      success: true,
      message: `OTP telah dikirim ke ${user.email}`,
    });
  } catch (error) {
    console.error("requestOtp error:", error);
    res.status(500).json({ success: false, message: "Gagal mengirim OTP." });
  }
};

// ── PUT /api/users/change-password ───────────────────────────────────────────
const changePassword = async (req, res) => {
  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return res.status(400).json({ success: false, message: "OTP dan password baru wajib diisi." });
    }

    const user = await User.findById(req.user._id).select("+password +passwordResetOtp");
    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    // Cek apakah OTP sudah expired
    if (!user.passwordResetOtpExpiry || user.passwordResetOtpExpiry < new Date()) {
      return res.status(400).json({ success: false, message: "OTP sudah kadaluarsa. Minta OTP baru." });
    }

    // Verifikasi OTP
    const hashedInput = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedInput !== user.passwordResetOtp) {
      return res.status(400).json({ success: false, message: "OTP tidak valid." });
    }

    // Simpan password baru (pre-save hook akan hash otomatis)
    user.password = newPassword;
    user.passwordResetOtp = null;
    user.passwordResetOtpExpiry = null;
    await user.save();

    res.status(200).json({ success: true, message: "Kata sandi berhasil diperbarui." });
  } catch (error) {
    console.error("changePassword error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan server." });
  }
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Selalu response sukses agar tidak bocorkan info email terdaftar atau tidak
    if (!user) {
      return res.status(200).json({ success: true, message: "Jika email terdaftar, OTP telah dikirim." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    user.passwordResetOtp = crypto.createHash("sha256").update(otp).digest("hex");
    user.passwordResetOtpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 menit
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({ success: true, message: "OTP telah dikirim ke email." });
  } catch (error) {
    console.error("forgotPassword error:", error);
    res.status(500).json({ success: false, message: "Gagal mengirim OTP." });
  }
};

// POST /api/auth/verify-otp
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

// POST /api/auth/reset-password
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

    user.password = newPassword; // pre-save hook otomatis hash
    user.passwordResetOtp = null;
    user.passwordResetOtpExpiry = null;
    await user.save();

    res.status(200).json({ success: true, message: "Kata sandi berhasil direset." });
  } catch (error) {
    console.error("resetPassword error:", error);
    res.status(500).json({ success: false, message: "Gagal mereset kata sandi." });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getHistory,
  clearHistory,
  addHistory,
  getLovedRecipes,
  markAsCooked,
  requestOtp,
  changePassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
};
