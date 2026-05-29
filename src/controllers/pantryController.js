const User = require("../models/User");
const { normalizeIngredient } = require("../utils/ingredientNormalizer");

// ── GET /api/pantry ───────────────────────────────────────────────────────────
const getPantry = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("pantry");

    // Cek bahan yang hampir kadaluarsa (dalam 3 hari)
    const now = new Date();
    const warningDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    const pantryWithStatus = user.pantry.map((item) => {
      let expiryStatus = null;
      if (item.expiryDate) {
        if (item.expiryDate < now) {
          expiryStatus = "expired";
        } else if (item.expiryDate <= warningDate) {
          expiryStatus = "expiring_soon";
        } else {
          expiryStatus = "fresh";
        }
      }
      return { ...item.toObject(), expiryStatus };
    });

    // Pisahkan bahan yang hampir kadaluarsa
    const expiringSoon = pantryWithStatus.filter(
      (i) => i.expiryStatus === "expiring_soon" || i.expiryStatus === "expired"
    );

    res.status(200).json({
      success: true,
      data: {
        pantry: pantryWithStatus,
        total: pantryWithStatus.length,
        expiringSoon,
        expiringCount: expiringSoon.length,
      },
    });
  } catch (error) {
    console.error("getPantry error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil pantry." });
  }
};

// ── POST /api/pantry ──────────────────────────────────────────────────────────
// Tambah satu atau beberapa bahan ke pantry
const addToPantry = async (req, res) => {
  try {
    const { ingredients } = req.body;

    // Bisa menerima array atau single object
    const items = Array.isArray(ingredients) ? ingredients : [req.body];

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Minimal satu bahan harus diisi.",
      });
    }

    const user = await User.findById(req.user._id).select("pantry");
    const added = [];
    const duplicates = [];

    for (const item of items) {
      if (!item.name || !item.name.trim()) continue;

      const normalizedName = normalizeIngredient(item.name);

      // Cek duplikasi
      const exists = user.pantry.some(
        (p) =>
          p.name === normalizedName ||
          p.aliases.includes(item.name.toLowerCase().trim())
      );

      if (exists) {
        duplicates.push(item.name);
        continue;
      }

      const newItem = {
        name: normalizedName,
        aliases: item.name.toLowerCase().trim() !== normalizedName
          ? [item.name.toLowerCase().trim()]
          : [],
        quantity: item.quantity || null,
        unit: item.unit || null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        notes: item.notes || "",
        image: item.image || null, // ← tambah ini
      };

      user.pantry.push(newItem);
      added.push(newItem);
    }

    await user.save();

    res.status(201).json({
      success: true,
      message: `${added.length} bahan berhasil ditambahkan ke pantry.${
        duplicates.length > 0 ? ` (${duplicates.join(", ")} sudah ada)` : ""
      }`,
      data: {
        added,
        duplicates,
        pantryTotal: user.pantry.length,
      },
    });
  } catch (error) {
    console.error("addToPantry error:", error);
    res.status(500).json({ success: false, message: "Gagal menambahkan bahan." });
  }
};

// ── PUT /api/pantry/:itemId ───────────────────────────────────────────────────
const updatePantryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, quantity, unit, expiryDate, notes } = req.body;

    const user = await User.findById(req.user._id).select("pantry");
    const item = user.pantry.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Bahan tidak ditemukan di pantry.",
      });
    }

    if (name) item.name = normalizeIngredient(name);
    if (quantity !== undefined) item.quantity = quantity;
    if (unit !== undefined) item.unit = unit;
    if (expiryDate !== undefined)
      item.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (notes !== undefined) item.notes = notes;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Bahan berhasil diperbarui.",
      data: { item },
    });
  } catch (error) {
    console.error("updatePantryItem error:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui bahan." });
  }
};

// ── DELETE /api/pantry/:itemId ────────────────────────────────────────────────
const removeFromPantry = async (req, res) => {
  try {
    const { itemId } = req.params;

    const user = await User.findById(req.user._id).select("pantry");
    const item = user.pantry.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Bahan tidak ditemukan.",
      });
    }

    const itemName = item.name;
    user.pantry.pull(itemId);
    await user.save();

    res.status(200).json({
      success: true,
      message: `"${itemName}" berhasil dihapus dari pantry.`,
    });
  } catch (error) {
    console.error("removeFromPantry error:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus bahan." });
  }
};

// ── DELETE /api/pantry ────────────────────────────────────────────────────────
// Hapus semua bahan dari pantry
const clearPantry = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { pantry: [] } });
    res.status(200).json({
      success: true,
      message: "Semua bahan berhasil dihapus dari pantry.",
    });
  } catch (error) {
    console.error("clearPantry error:", error);
    res.status(500).json({ success: false, message: "Gagal mengosongkan pantry." });
  }
};

// ── GET /api/pantry/expiring ──────────────────────────────────────────────────
// Ambil bahan yang mendekati/sudah kadaluarsa
const getExpiringItems = async (req, res) => {
  try {
    const { days = 3 } = req.query;
    const user = await User.findById(req.user._id).select("pantry");

    const now = new Date();
    const futureDate = new Date(now.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

    const expiring = user.pantry.filter(
      (item) => item.expiryDate && item.expiryDate <= futureDate
    );

    res.status(200).json({
      success: true,
      data: {
        expiringItems: expiring,
        count: expiring.length,
        withinDays: parseInt(days),
      },
    });
  } catch (error) {
    console.error("getExpiringItems error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data kadaluarsa." });
  }
};

module.exports = {
  getPantry,
  addToPantry,
  updatePantryItem,
  removeFromPantry,
  clearPantry,
  getExpiringItems,
};
