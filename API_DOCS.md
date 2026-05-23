# 🍳 OLAH API Documentation
**CC26-PSU127 | Coding Camp 2026 powered by DBS Foundation**

Base URL: `http://localhost:5000/api`

---

## 🏗️ Arsitektur Sistem

```
Frontend (React)
      │
      ▼
Express Backend (port 5000)  ←── JWT Auth, Pantry, Shopping List, History
      │
      ├──[Primary]──► FastAPI AI Service (port 8000)   ← Tim AI (TensorFlow)
      │                  POST /recommend
      │                  POST /similar
      │                  GET  /recipe/popular
      │                  GET  /recipe/random
      │
      └──[Fallback]──► MongoDB Atlas  ← jika AI service tidak tersedia
```

**Catatan penting untuk Tim Frontend:**
- Field `source` di response menunjukkan engine yang dipakai: `"ai_model"` atau `"js_fallback"`
- Format response **selalu sama** — tidak perlu kode berbeda untuk tiap engine
- Jika AI service down, fallback JS tetap berjalan otomatis

---

## 🔐 Authentication

Header wajib untuk endpoint protected (🔒):
```
Authorization: Bearer <token>
```

---

## AUTH `/api/auth`

### POST `/api/auth/register`
**Body:** `{ "name": "Budi", "email": "budi@email.com", "password": "rahasia123" }`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Budi", "email": "...", "pantryCount": 0 },
    "token": "eyJhbGci..."
  }
}
```

### POST `/api/auth/login`
**Body:** `{ "email": "budi@email.com", "password": "rahasia123" }`

### GET `/api/auth/me` 🔒
Data user yang sedang login.

### PUT `/api/auth/change-password` 🔒
**Body:** `{ "currentPassword": "lama123", "newPassword": "baru456" }`

---

## 🍲 RECIPES `/api/recipes`

### GET `/api/recipes/ai-status`
Cek apakah AI model (FastAPI) sedang aktif. Berguna untuk menampilkan badge di UI.

**Response:**
```json
{
  "success": true,
  "data": {
    "aiAvailable": true,
    "aiUrl": "http://localhost:8000",
    "aiHealth": { "status": "ok", "model_loaded": true, "total_recipes": 500 }
  }
}
```

---

### ⭐ GET `/api/recipes/recommend` *(optional auth)*
**Endpoint utama rekomendasi.** Panggil FastAPI AI → fallback JS jika AI down.

Jika user **sudah login** → bahan pantry otomatis digabungkan.

**Query params:**
| Param | Default | Deskripsi |
|-------|---------|-----------|
| `ingredients` | - | Bahan user, comma-separated: `ayam,bawang,kemiri` |
| `top_k` / `limit` | 10 | Jumlah rekomendasi (max 50) |
| `category` | - | Filter kategori: `ayam`, `sapi`, `ikan`, dll |
| `min_similarity` | 0.1 | Threshold AI (0.0–1.0) |
| `minCoverage` | 30 | Threshold coverage% fallback JS (0–100) |
| `source` | - | Dev only: `"js"` untuk paksa pakai fallback |

**Response 200:**
```json
{
  "success": true,
  "source": "ai_model",
  "data": {
    "recommendations": [
      {
        "recipe": {
          "recipeId": 1,
          "recipeName": "Opor Ayam",
          "category": "ayam",
          "ingredients": ["ayam", "santan", "bawang merah", "kemiri"],
          "totalIngredients": 4,
          "loveCount": 240,
          "steps": ["..."],
          "url": "https://cookpad.com/...",
          "imageUrl": null,
          "similarity": 0.87
        },
        "matchInfo": {
          "similarity": 0.87,
          "matchScore": 87.0,
          "coveragePercent": 75.0,
          "matchedIngredients": ["ayam", "bawang merah"],
          "missingIngredients": ["santan", "kemiri"],
          "missingCount": 2
        }
      }
    ],
    "userIngredients": ["ayam", "bawang"],
    "totalMatched": 15,
    "processingTimeMs": 42.3,
    "meta": {
      "engine": "AI Model (TensorFlow)",
      "minSimilarity": 0.1
    }
  }
}
```

---

### GET `/api/recipes/similar?name=opor+ayam&top_k=5`
Resep mirip — untuk halaman detail resep. Proxy ke FastAPI `/similar`.

**Response:**
```json
{
  "success": true,
  "source": "ai_model",
  "data": {
    "similarRecipes": [ { "recipeName": "Gulai Ayam", ... } ],
    "baseRecipe": "opor ayam",
    "total": 5
  }
}
```

---

### GET `/api/recipes/popular?limit=8&category=ayam`
Resep paling banyak di-love. Proxy ke FastAPI `/recipe/popular`.

### GET `/api/recipes/random?limit=10&category=sapi`
Resep acak untuk halaman discovery. Proxy ke FastAPI `/recipe/random`.

### GET `/api/recipes/categories`
Daftar kategori beserta jumlah resep.

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      { "category": "ayam", "count": 120 },
      { "category": "sapi", "count": 85 }
    ]
  }
}
```

### GET `/api/recipes?page=1&limit=12&category=ayam&search=goreng`
Semua resep dengan pagination, filter, dan search.

### GET `/api/recipes/:id`
Detail satu resep. `:id` boleh MongoDB ObjectId atau `recipeId` (angka).
*(User login → otomatis masuk history)*

### POST `/api/recipes/:id/love` 🔒
Toggle love/unlove. Call sekali = love, call lagi = unlove.

**Response:** `{ "isLoved": true, "loveCount": 241 }`

---

## 🧅 PANTRY `/api/pantry` 🔒

### GET `/api/pantry`
```json
{
  "data": {
    "pantry": [
      {
        "_id": "...",
        "name": "telur",
        "quantity": 6,
        "unit": "butir",
        "expiryDate": "2026-06-01T00:00:00.000Z",
        "expiryStatus": "fresh"
      }
    ],
    "total": 10,
    "expiringSoon": [],
    "expiringCount": 0
  }
}
```
`expiryStatus`: `"fresh"` | `"expiring_soon"` | `"expired"` | `null`

### POST `/api/pantry` — Tambah satu bahan
```json
{ "name": "telur", "quantity": 6, "unit": "butir", "expiryDate": "2026-06-01" }
```

### POST `/api/pantry` — Tambah batch (array)
```json
{
  "ingredients": [
    { "name": "bawang merah", "quantity": 5, "unit": "siung" },
    { "name": "tomat", "quantity": 3, "unit": "buah" }
  ]
}
```

### PUT `/api/pantry/:itemId` — Update bahan (partial)
### DELETE `/api/pantry/:itemId` — Hapus satu bahan
### DELETE `/api/pantry/clear` — Kosongkan pantry
### GET `/api/pantry/expiring?days=3` — Bahan hampir kadaluarsa

---

## 🛒 SHOPPING LIST `/api/shopping-list` 🔒

### GET `/api/shopping-list`
```json
{
  "data": {
    "shoppingList": [...],
    "unchecked": [...],
    "checked": [...],
    "total": 8
  }
}
```

### POST `/api/shopping-list` — Tambah satu item
```json
{ "name": "santan", "quantity": 1, "unit": "bungkus" }
```

### POST `/api/shopping-list` — Tambah batch
```json
{ "items": [{ "name": "santan" }, { "name": "kemiri", "quantity": 5 }] }
```

### ⭐ POST `/api/shopping-list/from-recipe`
Tambah **bahan yang kurang** dari hasil rekomendasi langsung ke shopping list.
```json
{ "missingIngredients": ["santan", "kemiri", "daun salam"] }
```

### PATCH `/api/shopping-list/:itemId/toggle` — Toggle checked
### PUT `/api/shopping-list/:itemId` — Update item
### DELETE `/api/shopping-list/clear-checked` — Hapus semua yang sudah dibeli
### DELETE `/api/shopping-list/:itemId` — Hapus satu item

---

## 👤 USERS `/api/users` 🔒

### GET `/api/users/profile`
Profil lengkap termasuk resep favorit (di-populate).

### PUT `/api/users/profile`
```json
{ "name": "Nama Baru", "bio": "Suka masak", "avatar": "https://..." }
```

### GET `/api/users/history?page=1&limit=20`
Riwayat resep yang pernah dilihat (terbaru dulu).

### DELETE `/api/users/history` — Hapus semua riwayat

### PATCH `/api/users/history/:historyId/cooked`
Tandai resep di riwayat sudah dimasak.

### GET `/api/users/loved-recipes`
Daftar resep yang di-love (di-populate dengan detail resep).

---

## 💡 Contoh Penggunaan di Frontend (Axios)

```javascript
import axios from "axios";

const API = axios.create({ baseURL: "http://localhost:5000/api" });

// Tambahkan token ke setiap request otomatis
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Rekomendasi resep ─────────────────────────────────────────────────────────
// Tanpa login (dari input user di halaman utama)
const recommend = await API.get("/recipes/recommend", {
  params: { ingredients: "ayam,bawang,kemiri", top_k: 10 }
});

// ── Tambah bahan ke pantry ────────────────────────────────────────────────────
await API.post("/pantry", { name: "telur", quantity: 6, unit: "butir" });

// ── Tambah bahan kurang ke shopping list (dari halaman detail resep) ──────────
await API.post("/shopping-list/from-recipe", {
  missingIngredients: recommend.data.data.recommendations[0].matchInfo.missingIngredients
});

// ── Cek AI status untuk badge di navbar ──────────────────────────────────────
const status = await API.get("/recipes/ai-status");
const isAIOnline = status.data.data.aiAvailable;
```

---

## ⚠️ Error Response Format
```json
{ "success": false, "message": "Deskripsi error yang jelas" }
```

| Status | Arti |
|--------|------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (token tidak ada/expired) |
| 404 | Not Found |
| 409 | Conflict (email duplikat, dll) |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | AI Service belum siap (model loading) |
