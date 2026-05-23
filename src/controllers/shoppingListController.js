const User = require("../models/User");

// ── GET /api/shopping-list ────────────────────────────────────────────────────
const getShoppingList = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("shoppingList");
    const unchecked = user.shoppingList.filter((i) => !i.checked);
    const checked = user.shoppingList.filter((i) => i.checked);

    res.status(200).json({
      success: true,
      data: {
        shoppingList: user.shoppingList,
        unchecked,
        checked,
        total: user.shoppingList.length,
      },
    });
  } catch (error) {
    console.error("getShoppingList error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil daftar belanja." });
  }
};

// ── POST /api/shopping-list ───────────────────────────────────────────────────
// Tambah satu atau beberapa item
const addToShoppingList = async (req, res) => {
  try {
    const { items } = req.body;

    const newItems = Array.isArray(items)
      ? items
      : [{ name: req.body.name, quantity: req.body.quantity, unit: req.body.unit }];

    const validItems = newItems.filter((i) => i.name && i.name.trim());
    if (validItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nama item wajib diisi.",
      });
    }

    const itemsToAdd = validItems.map((i) => ({
      name: i.name.trim(),
      quantity: i.quantity || null,
      unit: i.unit || null,
      checked: false,
    }));

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { shoppingList: { $each: itemsToAdd } } },
      { new: true }
    ).select("shoppingList");

    res.status(201).json({
      success: true,
      message: `${itemsToAdd.length} item ditambahkan ke daftar belanja.`,
      data: { shoppingList: user.shoppingList },
    });
  } catch (error) {
    console.error("addToShoppingList error:", error);
    res.status(500).json({ success: false, message: "Gagal menambahkan item." });
  }
};

// ── PUT /api/shopping-list/:itemId ───────────────────────────────────────────
const updateShoppingItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, quantity, unit, checked } = req.body;

    const user = await User.findById(req.user._id).select("shoppingList");
    const item = user.shoppingList.id(itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item tidak ditemukan.",
      });
    }

    if (name !== undefined) item.name = name.trim();
    if (quantity !== undefined) item.quantity = quantity;
    if (unit !== undefined) item.unit = unit;
    if (checked !== undefined) item.checked = checked;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Item berhasil diperbarui.",
      data: { item },
    });
  } catch (error) {
    console.error("updateShoppingItem error:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui item." });
  }
};

// ── PATCH /api/shopping-list/:itemId/toggle ───────────────────────────────────
// Toggle check/uncheck item
const toggleShoppingItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const user = await User.findById(req.user._id).select("shoppingList");
    const item = user.shoppingList.id(itemId);

    if (!item) {
      return res.status(404).json({ success: false, message: "Item tidak ditemukan." });
    }

    item.checked = !item.checked;
    await user.save();

    res.status(200).json({
      success: true,
      message: item.checked ? "Item ditandai sudah dibeli." : "Item ditandai belum dibeli.",
      data: { item },
    });
  } catch (error) {
    console.error("toggleShoppingItem error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
};

// ── DELETE /api/shopping-list/:itemId ─────────────────────────────────────────
const removeShoppingItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const user = await User.findById(req.user._id).select("shoppingList");
    const item = user.shoppingList.id(itemId);

    if (!item) {
      return res.status(404).json({ success: false, message: "Item tidak ditemukan." });
    }

    user.shoppingList.pull(itemId);
    await user.save();

    res.status(200).json({
      success: true,
      message: "Item berhasil dihapus dari daftar belanja.",
    });
  } catch (error) {
    console.error("removeShoppingItem error:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus item." });
  }
};

// ── DELETE /api/shopping-list/checked ────────────────────────────────────────
// Hapus semua item yang sudah di-check
const clearCheckedItems = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("shoppingList");
    const beforeCount = user.shoppingList.length;
    user.shoppingList = user.shoppingList.filter((i) => !i.checked);
    const removed = beforeCount - user.shoppingList.length;
    await user.save();

    res.status(200).json({
      success: true,
      message: `${removed} item yang sudah dibeli berhasil dihapus.`,
      data: { shoppingList: user.shoppingList },
    });
  } catch (error) {
    console.error("clearCheckedItems error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
};

// ── POST /api/shopping-list/from-recipe ──────────────────────────────────────
// Tambah bahan yang missing dari rekomendasi resep ke shopping list
const addMissingIngredientsToList = async (req, res) => {
  try {
    const { missingIngredients } = req.body;

    if (!Array.isArray(missingIngredients) || missingIngredients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "missingIngredients harus berupa array.",
      });
    }

    const itemsToAdd = missingIngredients.map((ing) => ({
      name: typeof ing === "string" ? ing : ing.name,
      quantity: null,
      unit: null,
      checked: false,
    }));

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $push: { shoppingList: { $each: itemsToAdd } } },
      { new: true }
    ).select("shoppingList");

    res.status(201).json({
      success: true,
      message: `${itemsToAdd.length} bahan yang kurang ditambahkan ke daftar belanja.`,
      data: { shoppingList: user.shoppingList },
    });
  } catch (error) {
    console.error("addMissingIngredientsToList error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan." });
  }
};

module.exports = {
  getShoppingList,
  addToShoppingList,
  updateShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  clearCheckedItems,
  addMissingIngredientsToList,
};
