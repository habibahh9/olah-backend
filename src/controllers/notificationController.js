const User = require("../models/User");

// ── GET /api/users/notifications ─────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("pantry history");
    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    const notifications = [];
    const now = new Date();

    // ── 1. Notifikasi bahan kadaluarsa dari pantry ────────────────────────────
    user.pantry.forEach((item) => {
      if (!item.expiryDate) return;

      const expiry = new Date(item.expiryDate);
      const diffMs = expiry - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        notifications.push({
          id: `pantry-expired-${item._id}`,
          category: "Bahan Kadaluarsa",
          message: `${item.name} sudah kadaluarsa.`,
          time: `${Math.abs(diffDays)} hari lalu`,
          type: "danger",
          createdAt: expiry,
        });
      } else if (diffDays <= 3) {
        notifications.push({
          id: `pantry-expiring-${item._id}`,
          category: "Bahan Hampir Kadaluarsa",
          message: `${item.name} akan kadaluarsa dalam ${diffDays} hari.`,
          time: `${diffDays} hari lagi`,
          type: "warning",
          createdAt: now,
        });
      }
    });

    // ── 2. Notifikasi stok pantry hampir habis ────────────────────────────────
    user.pantry.forEach((item) => {
      if (item.quantity !== null && item.quantity <= 1) {
        notifications.push({
          id: `pantry-low-${item._id}`,
          category: "Stok",
          message: `Stok ${item.name} hampir habis.`,
          time: "Baru saja",
          type: "info",
          createdAt: now,
        });
      }
    });

    // ── 3. Notifikasi dari riwayat masak ──────────────────────────────────────
    const recentHistory = [...user.history]
      .reverse()
      .slice(0, 3);

    recentHistory.forEach((item) => {
      const viewedAt = new Date(item.viewedAt);
      const diffMs = now - viewedAt;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);

      const timeLabel = diffDays > 0
        ? `${diffDays} hari lalu`
        : diffHours > 0
        ? `${diffHours} jam lalu`
        : "Baru saja";

      if (!item.cooked) {
        notifications.push({
          id: `history-${item._id}`,
          category: "Resep Dilihat",
          message: `Kamu belum memasak "${item.recipeName}". Mau coba sekarang?`,
          time: timeLabel,
          type: "info",
          createdAt: viewedAt,
        });
      }
    });

    // Urutkan dari yang terbaru
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      data: {
        notifications,
        total: notifications.length,
      },
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil notifikasi." });
  }
};

module.exports = { getNotifications };