const User = require("../models/User");
const { normalizeIngredient } = require("../utils/ingredientNormalizer");

// ── Helper: hitung daysLeft dari expiryDate ───────────────────────────────────
const getDaysLeft = (expiryDate) => {
  if (!expiryDate) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
};

// ── Helper: hitung expiryStatus ──────────────────────────────────────────────
const getExpiryStatus = (expiryDate) => {
  if (!expiryDate) return null;
  const daysLeft = getDaysLeft(expiryDate);
  if (daysLeft < 0)  return "expired";
  if (daysLeft <= 3) return "expiring_soon";
  return "fresh";
};

// ── Helper: auto-expire bahan yang lewat tanggal ─────────────────────────────
const autoExpireItems = async (user) => {
  const now = new Date();
  let needsSave = false;
  user.pantry.forEach((item) => {
    if (item.status === "active" && item.expiryDate && new Date(item.expiryDate) < now) {
      item.status    = "expired";
      item.expiredAt = now;
      needsSave      = true;
    }
  });
  if (needsSave) await user.save();
  return needsSave;
};

// ── GET /api/pantry ───────────────────────────────────────────────────────────
const getPantry = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("pantry");
    await autoExpireItems(user);

    const pantryWithStatus = user.pantry
      .filter((item) => item.status === "active")
      .map((item) => ({
        ...item.toObject(),
        daysLeft:     getDaysLeft(item.expiryDate),
        expiryStatus: getExpiryStatus(item.expiryDate),
      }));

    const expiringSoon = pantryWithStatus.filter(
      (i) => i.expiryStatus === "expiring_soon" || i.expiryStatus === "expired"
    );

    res.status(200).json({
      success: true,
      data: {
        pantry:        pantryWithStatus,
        total:         pantryWithStatus.length,
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
const addToPantry = async (req, res) => {
  try {
    const { ingredients } = req.body;
    const items = Array.isArray(ingredients) ? ingredients : [req.body];

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Minimal satu bahan harus diisi." });
    }

    const user = await User.findById(req.user._id).select("pantry");
    const added      = [];
    const duplicates = [];

    for (const item of items) {
      if (!item.name?.trim()) continue;
      const normalizedName = normalizeIngredient(item.name);

      // Cek duplikasi hanya di bahan aktif
      const exists = user.pantry.some(
        (p) =>
          p.status === "active" &&
          (p.name === normalizedName || p.aliases.includes(item.name.toLowerCase().trim()))
      );

      if (exists) { duplicates.push(item.name); continue; }

      const newItem = {
        name:       normalizedName,
        aliases:    item.name.toLowerCase().trim() !== normalizedName
          ? [item.name.toLowerCase().trim()] : [],
        quantity:   item.quantity   || null,
        unit:       item.unit       || null,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
        notes:      item.notes      || "",
        image:      item.image      || null,
        status:     "active",   // ✅ selalu active saat baru ditambah
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
        pantryTotal: user.pantry.filter((p) => p.status === "active").length,
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
      return res.status(404).json({ success: false, message: "Bahan tidak ditemukan di pantry." });
    }

    if (name !== undefined)       item.name       = normalizeIngredient(name);
    if (quantity !== undefined)   item.quantity   = quantity;
    if (unit !== undefined)       item.unit       = unit;
    if (expiryDate !== undefined) item.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (notes !== undefined)      item.notes      = notes;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Bahan berhasil diperbarui.",
      data: {
        item: {
          ...item.toObject(),
          daysLeft:     getDaysLeft(item.expiryDate),
          expiryStatus: getExpiryStatus(item.expiryDate),
        },
      },
    });
  } catch (error) {
    console.error("updatePantryItem error:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui bahan." });
  }
};

// ── DELETE /api/pantry/:itemId ────────────────────────────────────────────────
// ✅ DIUBAH: tandai "used" dulu (terselamatkan) baru hapus
const removeFromPantry = async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = await User.findById(req.user._id).select("pantry");
    const item = user.pantry.id(itemId);

    if (!item) {
      return res.status(404).json({ success: false, message: "Bahan tidak ditemukan." });
    }

    const itemName = item.name;

    // Tandai used dulu untuk statistik chart
    item.status = "used";
    item.usedAt = new Date();
    await user.save();

    // Baru hapus dari array
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
const clearPantry = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $set: { pantry: [] } });
    res.status(200).json({ success: true, message: "Semua bahan berhasil dihapus dari pantry." });
  } catch (error) {
    console.error("clearPantry error:", error);
    res.status(500).json({ success: false, message: "Gagal mengosongkan pantry." });
  }
};

// ── GET /api/pantry/expiring ──────────────────────────────────────────────────
const getExpiringItems = async (req, res) => {
  try {
    const { days = 3 } = req.query;
    const user = await User.findById(req.user._id).select("pantry");
    await autoExpireItems(user);

    const now        = new Date();
    const futureDate = new Date(now.getTime() + parseInt(days) * 24 * 60 * 60 * 1000);

    const expiring = user.pantry
      .filter((item) => item.status === "active" && item.expiryDate && item.expiryDate <= futureDate)
      .map((item) => ({
        ...item.toObject(),
        daysLeft:     getDaysLeft(item.expiryDate),
        expiryStatus: getExpiryStatus(item.expiryDate),
      }));

    res.status(200).json({
      success: true,
      data: { expiringItems: expiring, count: expiring.length, withinDays: parseInt(days) },
    });
  } catch (error) {
    console.error("getExpiringItems error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data kadaluarsa." });
  }
};

// ── PATCH /api/pantry/:itemId/use ─────────────────────────────────────────────
// ✅ BARU: eksplisit tandai dipakai (dari tombol "Sudah Dipakai" di UI)
const markUsed = async (req, res) => {
  try {
    const { itemId } = req.params;
    const user = await User.findById(req.user._id).select("pantry");
    const item = user.pantry.id(itemId);

    if (!item) {
      return res.status(404).json({ success: false, message: "Bahan tidak ditemukan." });
    }

    const itemName  = item.name;
    item.status     = "used";
    item.usedAt     = new Date();
    await user.save();

    user.pantry.pull(itemId);
    await user.save();

    res.status(200).json({
      success: true,
      message: `"${itemName}" ditandai sebagai sudah dipakai.`,
      data: { itemName },
    });
  } catch (error) {
    console.error("markUsed error:", error);
    res.status(500).json({ success: false, message: "Gagal menandai bahan." });
  }
};

// ── GET /api/pantry/stats ─────────────────────────────────────────────────────
// ✅ BARU: data untuk chart doughnut terselamatkan vs terbuang
const getStats = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("pantry");
    await autoExpireItems(user);

    const allItems    = user.pantry;
    const savedCount  = allItems.filter((i) => i.status === "used").length;
    const wastedCount = allItems.filter((i) => i.status === "expired").length;
    const activeCount = allItems.filter((i) => i.status === "active").length;
    const total       = savedCount + wastedCount;
    const savedPct    = total > 0 ? Math.round((savedCount / total) * 100) : 0;
    const wastedPct   = total > 0 ? Math.round((wastedCount / total) * 100) : 0;

    // ── Kategorikan semua bahan aktif ────────────────────────────────────
    const expired    = [];
    const nearExpiry = [];  // 1–7 hari
    const stillFresh = [];  // > 7 hari atau tanpa tanggal

    allItems
      .filter((i) => i.status === "active")
      .forEach((i) => {
        const daysLeft = getDaysLeft(i.expiryDate);
        const entry = {
          id:         i._id,
          name:       i.name,
          daysLeft,
          expiryDate: i.expiryDate,
          quantity:   i.quantity,
          unit:       i.unit,
        };

        if (daysLeft === null) {
          stillFresh.push(entry);
        } else if (daysLeft <= 0) {
          expired.push(entry);
        } else if (daysLeft <= 5) {
          nearExpiry.push(entry);
        } else {
          stillFresh.push(entry);
        }
      });

    const sortByDays = (a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999);
    expired.sort(sortByDays);
    nearExpiry.sort(sortByDays);
    stillFresh.sort(sortByDays);

    res.status(200).json({
        success: true,
        data: {
          chart:       { saved: savedCount, wasted: wastedCount, savedPct, wastedPct, total },
          categories: {
            expired,
            nearExpiry,
            stillFresh,
          },
          // tetap kirim expiringSoon untuk kompatibilitas bagian lain
          expiringSoon: [...expired, ...nearExpiry].sort(sortByDays),
          summary:     { active: activeCount, used: savedCount, expired: wastedCount },
        },
      });
  } catch (error) {
    console.error("getStats error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil statistik pantry." });
  }
};

module.exports = {
  getPantry,
  addToPantry,
  updatePantryItem,
  removeFromPantry,
  clearPantry,
  getExpiringItems,
  markUsed, 
  getStats,   
};