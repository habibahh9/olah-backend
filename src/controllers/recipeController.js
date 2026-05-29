/**
 * Recipe Controller
 * CC26-PSU127 - OLAH
 *
 * Alur rekomendasi:
 *   1. Coba panggil FastAPI AI (Tim AI - port 8000)
 *   2. Jika AI service tidak tersedia / error → fallback ke JS engine (ingredientNormalizer)
 *   3. Response ke frontend selalu dalam format yang sama
 */

const Recipe = require("../models/Recipe");
const User = require("../models/User");
const { calculateMatchScore } = require("../utils/ingredientNormalizer");
const aiClient = require("../utils/aiServiceClient");

// ── Mapper: format resep dari FastAPI → format konsisten untuk frontend ───────
// FastAPI mengembalikan field dari recipe_metadata.json secara langsung.
// Kita pastikan fieldnya konsisten apa pun sumbernya.
const formatRecipeFromAI = (r) => ({
  recipeId: r.recipe_id ?? r.recipeId ?? null,
  recipeName: r.recipe_name ?? r.recipeName ?? "",
  category: r.category ?? "",
  ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
  totalIngredients: r.total_ingredients ?? r.totalIngredients ?? 0,
  loveCount: r.love_count ?? r.loveCount ?? 0,
  steps: Array.isArray(r.steps) ? r.steps : [],
  url: r.url ?? null,
  imageUrl: r.image_url ?? r.imageUrl ?? null,
  // Field tambahan dari AI model
  similarity: r.similarity ?? null,
  matchScore: r.match_score ?? r.matchScore ?? null,
  ingredientsCleaned: r.ingredients_cleaned ?? r.ingredientsCleaned ?? "",
});

// ── GET /api/recipes ──────────────────────────────────────────────────────────
const getAllRecipes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      sortBy = "loveCount",
      order = "desc",
    } = req.query;

    const filter = {};
    if (category && category !== "semua") {
      filter.category = category.toLowerCase();
    }
    if (search && search.trim()) {
      filter.$or = [
        { recipeName: { $regex: search.trim(), $options: "i" } },
        { ingredientsCleaned: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const sortOptions = { [sortBy]: order === "asc" ? 1 : -1 };
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [recipes, total] = await Promise.all([
      Recipe.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .select("-ingredientsNormalized -__v"),
      Recipe.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        recipes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("getAllRecipes error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil resep." });
  }
};

// ── GET /api/recipes/recommend ────────────────────────────────────────────────
/**
 * Sistem Rekomendasi Utama.
 * Prioritas: AI model (FastAPI) → fallback JS engine (MongoDB).
 *
 * Query params:
 *   ingredients   : bahan comma-separated (e.g. "ayam,bawang,kemiri")
 *   top_k / limit : jumlah hasil (default 10)
 *   category      : filter kategori (e.g. "ayam")
 *   min_similarity: threshold similarity AI (default 0.1)
 *   minCoverage   : threshold coverage% fallback JS (default 30)
 *   source        : "ai" | "js" — paksa gunakan engine tertentu (dev only)
 */
const getRecommendations = async (req, res) => {
  try {
    const {
      ingredients: queryIngredients,
      top_k,
      limit = 10,
      category,
      min_similarity,
      minCoverage = 30,
      source, // "ai" | "js" — paksa engine (untuk testing)
    } = req.query;

    const limitNum = Math.min(50, Math.max(1, parseInt(top_k || limit)));

    // ── Kumpulkan bahan user ───────────────────────────────────────────────
    let userIngredients = [];

    if (queryIngredients) {
      userIngredients = queryIngredients
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);
    }

    // Jika sudah login → tambahkan bahan dari pantry
    if (req.user) {
      const user = await User.findById(req.user._id).select("pantry");
      if (user?.pantry?.length > 0) {
        const pantryNames = user.pantry.map((p) => p.name);
        userIngredients = [...new Set([...userIngredients, ...pantryNames])];
      }
    }

    if (userIngredients.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Masukkan minimal 1 bahan. Gunakan ?ingredients=ayam,bawang atau tambahkan bahan ke pantry Anda.",
      });
    }

    // ── 1. Coba AI Engine (FastAPI) ───────────────────────────────────────
    if (source !== "js") {
      try {
        const aiResult = await aiClient.getAIRecommendations(userIngredients, {
          top_k: limitNum,
          category_filter: category && category !== "semua" ? category : undefined,
          min_similarity: min_similarity ? parseFloat(min_similarity) : 0.1,
        });

        // Validasi response dari FastAPI
        if (aiResult.status === "success" && Array.isArray(aiResult.recipes)) {
          return res.status(200).json({
            success: true,
            source: "ai_model",
            data: {
              recommendations: aiResult.recipes.map((r) => ({
                recipe: formatRecipeFromAI(r),
                matchInfo: {
                  similarity: r.similarity ?? null,
                  matchScore: r.match_score ?? r.matchScore ?? null,
                  // Hitung juga coverage% untuk konsistensi UI
                  coveragePercent: r.coverage_percent ?? null,
                  matchedIngredients: r.matched_ingredients ?? [],
                  missingIngredients: r.missing_ingredients ?? [],
                  missingCount: r.missing_count ?? null,
                },
              })),
              userIngredients,
              totalMatched: aiResult.total ?? aiResult.recipes.length,
              processingTimeMs: aiResult.processing_time_ms ?? null,
              meta: {
                engine: "AI Model (TensorFlow)",
                minSimilarity: aiResult.min_similarity ?? parseFloat(min_similarity || 0.1),
              },
            },
          });
        }
      } catch (aiErr) {
        // AI service tidak tersedia — log & lanjut ke fallback
        console.warn(
          `[WARN] AI service tidak tersedia (${aiClient.AI_BASE_URL}): ${aiErr.message}`
        );
        console.warn("[WARN] Menggunakan JS fallback engine...");
      }
    }

    // ── 2. Fallback: JS Engine (MongoDB + ingredientNormalizer) ───────────
    console.log("[INFO] Menggunakan JS fallback engine untuk rekomendasi.");

    const recipeFilter = {};
    if (category && category !== "semua") {
      recipeFilter.category = category.toLowerCase();
    }

    const allRecipes = await Recipe.find(recipeFilter).select(
      "recipeId recipeName category ingredients ingredientsNormalized totalIngredients loveCount url imageUrl steps"
    );

    if (allRecipes.length === 0) {
      return res.status(200).json({
        success: true,
        source: "js_fallback",
        data: {
          recommendations: [],
          userIngredients,
          message: "Belum ada resep di database.",
        },
      });
    }

    const scored = allRecipes
      .map((recipe) => {
        const recipeIngs =
          recipe.ingredientsNormalized?.length > 0
            ? recipe.ingredientsNormalized
            : recipe.ingredients;

        const matchInfo = calculateMatchScore(userIngredients, recipeIngs);

        return {
          recipe: {
            id: recipe._id,
            recipeId: recipe.recipeId,
            recipeName: recipe.recipeName,
            category: recipe.category,
            ingredients: recipe.ingredients,
            totalIngredients: recipe.totalIngredients,
            loveCount: recipe.loveCount,
            url: recipe.url,
            imageUrl: recipe.imageUrl,
            stepsCount: recipe.steps?.length || 0,
          },
          matchInfo: {
            ...matchInfo,
            similarity: matchInfo.coveragePercent / 100, // normalized 0-1
            missingCount: matchInfo.missingIngredients.length,
          },
        };
      })
      .filter((r) => r.matchInfo.coveragePercent >= parseFloat(minCoverage))
      .sort((a, b) => {
        if (b.matchInfo.matchScore !== a.matchInfo.matchScore)
          return b.matchInfo.matchScore - a.matchInfo.matchScore;
        return b.recipe.loveCount - a.recipe.loveCount;
      });

    // Jika tidak ada yang memenuhi threshold → ambil top-5 tertinggi
    let isFallback = false;
    let results = scored.slice(0, limitNum);
    if (results.length === 0) {
      isFallback = true;
      results = allRecipes
        .map((recipe) => {
          const recipeIngs = recipe.ingredientsNormalized?.length > 0
            ? recipe.ingredientsNormalized : recipe.ingredients;
          const matchInfo = calculateMatchScore(userIngredients, recipeIngs);
          return { recipe: { id: recipe._id, recipeId: recipe.recipeId, recipeName: recipe.recipeName, category: recipe.category, ingredients: recipe.ingredients, totalIngredients: recipe.totalIngredients, loveCount: recipe.loveCount, url: recipe.url }, matchInfo };
        })
        .sort((a, b) => b.matchInfo.matchScore - a.matchInfo.matchScore)
        .slice(0, 5);
    }

    res.status(200).json({
      success: true,
      source: "js_fallback",
      data: {
        recommendations: results,
        isFallback,
        userIngredients,
        totalMatched: results.length,
        meta: {
          engine: "JS Fallback (Ingredient Matching)",
          minCoverage: parseFloat(minCoverage),
          aiServiceAvailable: false,
        },
      },
    });
  } catch (error) {
    console.error("getRecommendations error:", error);
    res.status(500).json({ success: false, message: "Gagal memproses rekomendasi." });
  }
};

// ── GET /api/recipes/similar ─────────────────────────────────────────────────
/**
 * Resep mirip berdasarkan nama resep — proxy ke FastAPI /similar
 * Digunakan di halaman detail resep.
 */
const getSimilarRecipes = async (req, res) => {
  try {
    const { name, top_k = 5 } = req.query;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Parameter 'name' (nama resep) wajib diisi.",
      });
    }

    try {
      const aiResult = await aiClient.getAISimilarRecipes(name.trim(), parseInt(top_k));
      if (aiResult.status === "success") {
        return res.status(200).json({
          success: true,
          source: "ai_model",
          data: {
            similarRecipes: (aiResult.similar_recipes || aiResult.recipes || []).map(formatRecipeFromAI),
            baseRecipe: name,
            total: aiResult.total ?? 0,
          },
        });
      }
    } catch (aiErr) {
      console.warn(`[WARN] AI similar endpoint error: ${aiErr.message}`);
    }

    // Fallback: cari di MongoDB berdasarkan kategori resep yang sama
    const baseRecipe = await Recipe.findOne({
      recipeName: { $regex: name.trim(), $options: "i" },
    });

    if (!baseRecipe) {
      return res.status(404).json({
        success: false,
        message: `Resep "${name}" tidak ditemukan.`,
      });
    }

    const similar = await Recipe.find({
      category: baseRecipe.category,
      _id: { $ne: baseRecipe._id },
    })
      .sort({ loveCount: -1 })
      .limit(parseInt(top_k))
      .select("-ingredientsNormalized -__v");

    res.status(200).json({
      success: true,
      source: "js_fallback",
      data: {
        similarRecipes: similar,
        baseRecipe: baseRecipe.recipeName,
        total: similar.length,
      },
    });
  } catch (error) {
    console.error("getSimilarRecipes error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil resep serupa." });
  }
};

// ── GET /api/recipes/popular ──────────────────────────────────────────────────
/**
 * Resep populer — coba AI dulu, fallback ke MongoDB.
 */
const getPopularRecipes = async (req, res) => {
  try {
    const { limit = 8, category } = req.query;
    const n = Math.min(20, parseInt(limit));
    const cat = category && category !== "semua" ? category : null;

    try {
      const aiResult = await aiClient.getAIPopular(n, cat);
      if (aiResult.status === "success") {
        return res.status(200).json({
          success: true,
          source: "ai_model",
          data: { recipes: aiResult.recipes.map(formatRecipeFromAI) },
        });
      }
    } catch (aiErr) {
      console.warn(`[WARN] AI popular error: ${aiErr.message}`);
    }

    // Fallback MongoDB
    const filter = cat ? { category: cat } : {};
    const recipes = await Recipe.find(filter)
      .sort({ loveCount: -1 })
      .limit(n)
      .select("-ingredientsNormalized -__v");

    res.status(200).json({
      success: true,
      source: "js_fallback",
      data: { recipes },
    });
  } catch (error) {
    console.error("getPopularRecipes error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil resep populer." });
  }
};

// ── GET /api/recipes/random ───────────────────────────────────────────────────
const getRandomRecipes = async (req, res) => {
  try {
    const { limit = 10, category } = req.query;
    const n = Math.min(20, parseInt(limit));
    const cat = category && category !== "semua" ? category : null;

    try {
      const aiResult = await aiClient.getAIRandom(n, cat);
      if (aiResult.status === "success") {
        return res.status(200).json({
          success: true,
          source: "ai_model",
          data: { recipes: aiResult.recipes.map(formatRecipeFromAI) },
        });
      }
    } catch (aiErr) {
      console.warn(`[WARN] AI random error: ${aiErr.message}`);
    }

    // Fallback: MongoDB random sample
    const filter = cat ? { category: cat } : {};
    const count = await Recipe.countDocuments(filter);
    const skip = Math.floor(Math.random() * Math.max(0, count - n));
    const recipes = await Recipe.find(filter)
      .skip(skip)
      .limit(n)
      .select("-ingredientsNormalized -__v");

    res.status(200).json({
      success: true,
      source: "js_fallback",
      data: { recipes },
    });
  } catch (error) {
    console.error("getRandomRecipes error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil resep acak." });
  }
};

// ── GET /api/recipes/categories ───────────────────────────────────────────────
const getCategories = async (req, res) => {
  try {
    // Coba ambil dari AI (sudah ada list hardcoded yang valid)
    try {
      const aiResult = await aiClient.getAICategories();
      if (aiResult.status === "success" && Array.isArray(aiResult.categories)) {
        // Gabungkan dengan count dari MongoDB
        const dbCategories = await Recipe.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]);
        const countMap = Object.fromEntries(dbCategories.map((c) => [c._id, c.count]));

        return res.status(200).json({
          success: true,
          data: {
            categories: aiResult.categories.map((cat) => ({
              category: cat,
              count: countMap[cat] || 0,
            })),
          },
        });
      }
    } catch (aiErr) {
      console.warn(`[WARN] AI categories error: ${aiErr.message}`);
    }

    // Fallback: dari MongoDB
    const categories = await Recipe.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, category: "$_id", count: 1 } },
    ]);

    res.status(200).json({ success: true, data: { categories } });
  } catch (error) {
    console.error("getCategories error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil kategori." });
  }
};

// ── GET /api/recipes/:id ──────────────────────────────────────────────────────
const getRecipeById = async (req, res) => {
  try {
    const { id } = req.params;

    let recipe;
    if (/^\d+$/.test(id)) {
      recipe = await Recipe.findOne({ recipeId: parseInt(id) });
    } else {
      recipe = await Recipe.findById(id);
    }

    if (!recipe) {
      return res.status(404).json({ success: false, message: "Resep tidak ditemukan." });
    }

    // Tambahkan ke history jika user login
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $push: {
          history: {
            $each: [{ recipeId: recipe._id, recipeName: recipe.recipeName }],
            $slice: -50,
          },
        },
      });
    }

    let isLoved = false;
    if (req.user) {
      const user = await User.findById(req.user._id).select("lovedRecipes");
      isLoved = user.lovedRecipes.some((rid) => rid.toString() === recipe._id.toString());
    }

    res.status(200).json({ success: true, data: { recipe, isLoved } });
  } catch (error) {
    console.error("getRecipeById error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil resep." });
  }
};

// ── POST /api/recipes/:id/love ────────────────────────────────────────────────
const toggleLoveRecipe = async (req, res) => {
  try {
    const { id } = req.params;

    const recipe = await Recipe.findById(id);
    if (!recipe) {
      return res.status(404).json({ success: false, message: "Resep tidak ditemukan." });
    }

    const user = await User.findById(req.user._id).select("lovedRecipes");
    const alreadyLoved = user.lovedRecipes.some((rid) => rid.toString() === id);

    if (alreadyLoved) {
      await User.findByIdAndUpdate(req.user._id, { $pull: { lovedRecipes: recipe._id } });
      await Recipe.findByIdAndUpdate(id, { $inc: { loveCount: -1 } });
      return res.status(200).json({
        success: true,
        message: "Resep dihapus dari favorit.",
        data: { isLoved: false, loveCount: Math.max(0, recipe.loveCount - 1) },
      });
    } else {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { lovedRecipes: recipe._id } });
      await Recipe.findByIdAndUpdate(id, { $inc: { loveCount: 1 } });
      return res.status(200).json({
        success: true,
        message: "Resep ditambahkan ke favorit!",
        data: { isLoved: true, loveCount: recipe.loveCount + 1 },
      });
    }
  } catch (error) {
    console.error("toggleLoveRecipe error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
};

// ── GET /api/recipes/ai-status ────────────────────────────────────────────────
// Endpoint untuk frontend cek apakah AI model tersedia
const getAIStatus = async (req, res) => {
  try {
    const { ok, data } = await aiClient.checkHealth();
    res.status(200).json({
      success: true,
      data: {
        aiAvailable: ok,
        aiUrl: aiClient.AI_BASE_URL,
        aiHealth: data,
      },
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      data: { aiAvailable: false, aiUrl: aiClient.AI_BASE_URL, aiHealth: null },
    });
  }
};

module.exports = {
  getAllRecipes,
  getRecommendations,
  getSimilarRecipes,
  getPopularRecipes,
  getRandomRecipes,
  getCategories,
  getRecipeById,
  toggleLoveRecipe,
  getAIStatus,
};
