const User = require("../models/User");

// ── GET /api/users/notifications ─────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("pantry history dismissedNotifications");

    if (!user) {
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    const notifications = [];
    const now = new Date();
    const dismissed = new Set(user.dismissedNotifications || []);

    // ── 1. Notifikasi bahan kadaluarsa ────────────────────────────────────────
    // ✅ FIX: hanya tampilkan bahan yang masih "active" di pantry
    // Bahan yang sudah dihapus (used/expired) tidak akan muncul lagi
    user.pantry
      .filter((item) => item.status === "active" && item.expiryDate)
      .forEach((item) => {
        const expiry   = new Date(item.expiryDate);
        const diffMs   = expiry - now;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          const notifId = `pantry-expired-${item._id}`;
          if (!dismissed.has(notifId)) {
            notifications.push({
              id:        notifId,
              category:  "Bahan Kadaluarsa",
              message:   `${item.name} sudah kadaluarsa. Segera periksa atau buang.`,
              time:      `${Math.abs(diffDays)} hari lalu`,
              type:      "danger",
              createdAt: expiry,
              dismissible: true,
            });
          }
        } else if (diffDays <= 3) {
          const notifId = `pantry-expiring-${item._id}`;
          if (!dismissed.has(notifId)) {
            notifications.push({
              id:        notifId,
              category:  "Hampir Kadaluarsa",
              message:   `${item.name} akan kadaluarsa dalam ${diffDays} hari.`,
              time:      `${diffDays} hari lagi`,
              type:      "warning",
              createdAt: now,
              dismissible: true,
            });
          }
        }
      });

    // ── 2. Notifikasi stok hampir habis ───────────────────────────────────────
    // ✅ FIX: hanya bahan aktif, dan hanya jika ada unit (agar tidak spam)
    user.pantry
      .filter((item) => item.status === "active" && item.quantity !== null && item.quantity <= 1 && item.unit)
      .forEach((item) => {
        const notifId = `pantry-low-${item._id}`;
        if (!dismissed.has(notifId)) {
          notifications.push({
            id:        notifId,
            category:  "Stok Menipis",
            message:   `Stok ${item.name} tinggal ${item.quantity} ${item.unit}.`,
            time:      "Baru saja",
            type:      "info",
            createdAt: now,
            dismissible: true,
          });
        }
      });

    // ── 3. Notifikasi riwayat masak ───────────────────────────────────────────
    // ✅ FIX: batasi 2 resep saja, dan hanya yang dilihat dalam 2 hari terakhir
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    const recentHistory = [...user.history]
      .reverse()
      .filter((item) => !item.cooked && new Date(item.viewedAt) >= twoDaysAgo)
      .slice(0, 2);

    recentHistory.forEach((item) => {
      const notifId  = `history-${item._id}`;
      if (dismissed.has(notifId)) return;

      const viewedAt  = new Date(item.viewedAt);
      const diffMs    = now - viewedAt;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays  = Math.floor(diffHours / 24);
      const timeLabel = diffDays > 0
        ? `${diffDays} hari lalu`
        : diffHours > 0
        ? `${diffHours} jam lalu`
        : "Baru saja";

      notifications.push({
        id:        notifId,
        category:  "Resep Dilihat",
        message:   `Kamu belum memasak "${item.recipeName}". Mau coba sekarang?`,
        time:      timeLabel,
        type:      "info",
        createdAt: viewedAt,
        dismissible: true,
      });
    });

    // Urutkan terbaru dulu, maksimal 10
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limited = notifications.slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        notifications: limited,
        total: limited.length,
      },
    });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil notifikasi." });
  }
};

// ── POST /api/users/notifications/dismiss ────────────────────────────────────
// User dismiss / tutup satu notifikasi agar tidak muncul lagi
const dismissNotification = async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({ success: false, message: "notificationId wajib diisi." });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { dismissedNotifications: notificationId },
    });

    res.status(200).json({ success: true, message: "Notifikasi disembunyikan." });
  } catch (error) {
    console.error("dismissNotification error:", error);
    res.status(500).json({ success: false, message: "Gagal menyembunyikan notifikasi." });
  }
};

// ── DELETE /api/users/notifications/dismiss ───────────────────────────────────
// Reset semua dismissed — tampilkan notifikasi dari awal lagi
const resetDismissed = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { dismissedNotifications: [] },
    });
    res.status(200).json({ success: true, message: "Semua notifikasi direset." });
  } catch (error) {
    console.error("resetDismissed error:", error);
    res.status(500).json({ success: false, message: "Gagal mereset notifikasi." });
  }
};

module.exports = { getNotifications, dismissNotification, resetDismissed };