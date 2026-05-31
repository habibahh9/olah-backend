const express = require("express");
const router = express.Router();
const {
  getAllRecipes,
  getRecommendations,
  getSimilarRecipes,
  getPopularRecipes,
  getRandomRecipes,
  getCategories,
  getRecipeById,
  toggleLoveRecipe,
  getAIStatus,
  selesaiMasak,
} = require("../controllers/recipeController");
const { protect } = require("../middleware/auth");

// Optional auth — decode token kalau ada, tapi tidak wajib
const optionalAuth = async (req, res, next) => {
  try {
    const jwt = require("jsonwebtoken");
    const User = require("../models/User");
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    }
  } catch {
    // Token tidak valid / tidak ada — lanjut tanpa user
  }
  next();
};

// ── Public / Optional Auth Routes ────────────────────────────────────────────
router.get("/ai-status",   getAIStatus);          // Cek status AI service
router.get("/categories",  getCategories);         // List kategori
router.get("/popular",     getPopularRecipes);     // Resep populer
router.get("/random",      getRandomRecipes);      // Resep acak (discovery)
router.get("/similar",     getSimilarRecipes);     // Resep mirip (detail page)
router.get("/recommend",   optionalAuth, getRecommendations); // Rekomendasi utama
router.get("/",            getAllRecipes);          // List semua resep
router.get("/:id",         optionalAuth, getRecipeById); // Detail resep

// ── Protected Routes ──────────────────────────────────────────────────────────
router.post("/:id/love",   protect, toggleLoveRecipe); // Toggle love
router.post("/:id/selesai", protect, selesaiMasak);     // ← tambahkan ini

module.exports = router;
