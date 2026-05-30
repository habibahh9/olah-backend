const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv').config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./src/config/db");

// ── Import Routes ─────────────────────────────────────────────────────────────
const authRoutes = require("./src/routes/auth");
const recipeRoutes = require("./src/routes/recipes");
const pantryRoutes = require("./src/routes/pantry");
const shoppingListRoutes = require("./src/routes/shoppingList");
const userRoutes = require("./src/routes/users");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Koneksi Database ──────────────────────────────────────────────────────────
connectDB();

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet());

// CORS - izinkan request dari frontend
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5174",
      // Tambahkan URL Vercel deployment nanti
    ];

    // Izinkan request tanpa origin (Postman, server-to-server)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} tidak diizinkan.`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// Rate limiter: lindungi dari abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 200,                  // maks 200 request per windowMs per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Terlalu banyak request. Coba lagi dalam 15 menit.",
  },
});
app.use(limiter);

// Rate limiter lebih ketat untuk auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Terlalu banyak percobaan login/register. Coba lagi nanti.",
  },
});



// ── General Middleware ────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ── Health Check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "OLAH API is running!",
    version: "1.0.0",
    team: "CC26-PSU127",
    endpoints: {
      auth: "/api/auth",
      recipes: "/api/recipes",
      pantry: "/api/pantry",
      shoppingList: "/api/shopping-list",
      users: "/api/users",
    },
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/pantry", pantryRoutes);
app.use("/api/shopping-list", shoppingListRoutes);
app.use("/api/users", userRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  // CORS error
  if (err.message && err.message.startsWith("CORS")) {
    return res.status(403).json({ success: false, message: err.message });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validasi gagal.",
      errors: messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} sudah digunakan.`,
    });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Terjadi kesalahan pada server.",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n" + "=".repeat(50));
  console.log(`OLAH Backend running on port ${PORT}`);
  console.log(`Environment  : ${process.env.NODE_ENV || "development"}`);
  console.log(`API Base URL : http://localhost:${PORT}/api`);
  console.log(`Health Check : http://localhost:${PORT}/api/health`);
  console.log("=".repeat(50) + "\n");
});

module.exports = app;
