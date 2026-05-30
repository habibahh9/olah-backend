const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ── Sub-schema: Bahan di dapur pengguna (pantry) ──────────────────────────────
const pantryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    aliases: [{ type: String, lowercase: true, trim: true }],
    quantity: { type: Number, default: null },
    unit:     { type: String, trim: true, default: null },
    expiryDate: { type: Date, default: null },
    addedAt:    { type: Date, default: Date.now },
    notes:      { type: String, trim: true, default: "" },
    image:      { type: String, default: null },

    status: {
      type: String,
      enum: ["active", "used", "expired"],
      default: "active",
    },
    // Kapan bahan ditandai sebagai dipakai
    usedAt: { type: Date, default: null },
    // Kapan bahan ditandai sebagai expired (oleh cron/endpoint)
    expiredAt: { type: Date, default: null },
  },
  { _id: true }
);

// ── Sub-schema: Daftar belanja ────────────────────────────────────────────────
const shoppingItemSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    quantity: { type: Number, default: null },
    unit:     { type: String, trim: true, default: null },
    checked:  { type: Boolean, default: false },
    addedAt:  { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── Sub-schema: Riwayat resep yang dilihat/dimasak ───────────────────────────
const historyItemSchema = new mongoose.Schema(
  {
    recipeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recipe",
      required: true,
    },
    recipeName: { type: String },
    viewedAt:   { type: Date, default: Date.now },
    cooked:     { type: Boolean, default: false },
    cookedAt:   { type: Date, default: null },
  },
  { _id: true }
);

// ── Main User Schema ──────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Nama wajib diisi"],
      trim: true,
      minlength: [2, "Nama minimal 2 karakter"],
      maxlength: [100, "Nama maksimal 100 karakter"],
    },
    email: {
      type: String,
      required: [true, "Email wajib diisi"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Format email tidak valid"],
    },
    password: {
      type: String,
      required: [true, "Password wajib diisi"],
      minlength: [6, "Password minimal 6 karakter"],
      select: false,
    },
    avatar: { type: String, default: null },
    bio:    { type: String, trim: true, default: "" },

    pantry:       [pantryItemSchema],
    shoppingList: [shoppingItemSchema],
    history:      { type: [historyItemSchema], default: [] },

    lovedRecipes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Recipe" }],

    preferences: {
      dietaryRestrictions: [String],
      allergies:           [String],
    },

    passwordResetOtp: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetOtpExpiry: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Hash password sebelum disimpan ───────────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Method: bandingkan password ───────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Virtual: jumlah bahan aktif di pantry ─────────────────────────────────────
userSchema.virtual("pantryCount").get(function () {
  return this.pantry.filter((p) => p.status === "active").length;
});

module.exports = mongoose.model("User", userSchema);