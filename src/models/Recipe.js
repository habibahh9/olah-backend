const mongoose = require("mongoose");

const recipeSchema = new mongoose.Schema(
  {
    // Sesuai dengan recipe_metadata.json dari tim AI
    recipeId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    recipeName: {
      type: String,
      required: true,
      trim: true,
      index: "text", // untuk full-text search
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
    },
    // Array bahan asli (belum dinormalisasi)
    ingredients: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    // Bahan yang sudah dibersihkan (dari AI team, format string CSV)
    ingredientsCleaned: {
      type: String,
      default: "",
    },
    // Array bahan yang sudah dinormalisasi (untuk matching)
    ingredientsNormalized: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    totalIngredients: {
      type: Number,
      default: 0,
    },
    // Langkah-langkah memasak
    steps: [
      {
        type: String,
        trim: true,
      },
    ],
    // Jumlah yang menyukai resep
    loveCount: {
      type: Number,
      default: 0,
    },
    // URL sumber resep (Cookpad, dll)
    url: {
      type: String,
      trim: true,
      default: null,
    },
    // Gambar resep (opsional)
    imageUrl: {
      type: String,
      default: null,
    },
    // Estimasi waktu memasak (opsional)
    cookingTimeMinutes: {
      type: Number,
      default: null,
    },
    // Tingkat kesulitan
    difficulty: {
      type: String,
      enum: ["mudah", "sedang", "sulit", null],
      default: null,
    },
    // Porsi
    servings: {
      type: Number,
      default: null,
    },
    // Tags untuk filtering
    tags: [{ type: String, lowercase: true }],
    // Rata-rata rating dari pengguna
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
recipeSchema.index({ recipeName: "text", ingredientsCleaned: "text" });
recipeSchema.index({ category: 1 });
recipeSchema.index({ loveCount: -1 });
recipeSchema.index({ ingredientsNormalized: 1 });

// ── Pre-save: normalisasi ingredients ────────────────────────────────────────
recipeSchema.pre("save", function (next) {
  if (this.isModified("ingredients") || this.isModified("ingredientsCleaned")) {
    // Normalize: lowercase, trim, hapus tanda baca berlebih
    const normalize = (str) =>
      str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (this.ingredients && this.ingredients.length > 0) {
      this.ingredientsNormalized = [...new Set(this.ingredients.map(normalize))];
      this.totalIngredients = this.ingredients.length;
    }
  }
  next();
});

module.exports = mongoose.model("Recipe", recipeSchema);
