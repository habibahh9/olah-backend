const User = require("../models/User");
const Recipe = require("../models/Recipe");

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
        select: "recipeName category ingredients totalIngredients loveCount imageUrl",
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

module.exports = {
  getProfile,
  updateProfile,
  getHistory,
  clearHistory,
  getLovedRecipes,
  markAsCooked,
};
