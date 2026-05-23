# 🍳 OLAH Backend

**Coding Camp 2026 powered by DBS Foundation | CC26-PSU127**

> "Punya sisa bahan makanan? di-OLAH aja!"

---

## 🏗️ Arsitektur

```
React Frontend (Vite, port 5173)
        │
        ▼
Express.js Backend (port 5000)     ← Repo ini
        │
        ├─ [Primary]──► FastAPI AI (port 8000)    ← Tim AI
        │                 • POST /recommend        (TensorFlow model)
        │                 • POST /similar
        │                 • GET  /recipe/popular
        │                 • GET  /recipe/random
        │
        └─ [Fallback]──► MongoDB Atlas             ← jika AI service down
```

**Express bertanggung jawab atas:**
- Autentikasi (JWT)
- Pantry management
- Shopping list
- History & profil user
- Proxy ke FastAPI AI + fallback JS jika AI tidak tersedia

---

## 📁 Struktur Proyek

```
olah-backend/
├── server.js
├── src/
│   ├── config/db.js
│   ├── models/
│   │   ├── User.js          # Embedded: pantry, shoppingList, history, lovedRecipes
│   │   └── Recipe.js        # Sesuai format recipe_metadata.json Tim AI
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── recipeController.js     # Proxy AI + fallback JS
│   │   ├── pantryController.js
│   │   ├── shoppingListController.js
│   │   └── userController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── recipes.js
│   │   ├── pantry.js
│   │   ├── shoppingList.js
│   │   └── users.js
│   ├── middleware/auth.js           # JWT verify
│   └── utils/
│       ├── aiServiceClient.js       # HTTP client ke FastAPI (Tim AI)
│       ├── ingredientNormalizer.js  # JS fallback: sinonim + fuzzy match
│       └── seedRecipes.js           # Import recipe_metadata.json → MongoDB
├── API_DOCS.md
├── .env.example
└── package.json
```

---

## 🚀 Setup

### 1. Install
```bash
npm install
```

### 2. Environment
```bash
cp .env.example .env
```
Isi `.env`:
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/olah_db
JWT_SECRET=kunci_panjang_rahasia_disini
CLIENT_URL=http://localhost:5173
PORT=5000

# URL FastAPI dari Tim AI
AI_MODEL_URL=http://localhost:8000
AI_TIMEOUT_MS=8000
```

### 3. Seed resep ke MongoDB
```bash
# Letakkan recipe_metadata.json di root folder ini, lalu:
npm run seed

# Reset database lalu seed ulang:
RESET=true npm run seed

# Path custom:
RECIPE_FILE=../ai/saved_model/recipe_metadata.json npm run seed
```

### 4. Jalankan
```bash
npm run dev    # development (nodemon)
npm start      # production
```

---

## 🔗 Integrasi dengan Tim AI (FastAPI)

Backend otomatis memanggil FastAPI jika `AI_MODEL_URL` tersedia.

**Urutan prioritas di setiap request rekomendasi:**
1. Panggil `POST {AI_MODEL_URL}/recommend`
2. Jika berhasil → kembalikan hasil AI ke frontend
3. Jika gagal (service down / timeout) → log warning, gunakan JS engine
4. Frontend **tidak perlu tahu** mana yang dipakai (format sama)

**Cek status AI dari frontend:**
```
GET /api/recipes/ai-status
```

**Endpoint yang di-proxy ke FastAPI:**

| Express | FastAPI |
|---------|---------|
| `GET /api/recipes/recommend` | `POST /recommend` |
| `GET /api/recipes/similar` | `POST /similar` |
| `GET /api/recipes/popular` | `GET /recipe/popular` |
| `GET /api/recipes/random` | `GET /recipe/random` |
| `GET /api/recipes/categories` | `GET /categories` |

---

## 🧪 Test Rekomendasi

```bash
# Test AI engine (FastAPI harus running)
curl "http://localhost:5000/api/recipes/recommend?ingredients=ayam,bawang,kemiri"

# Paksa pakai JS fallback (untuk testing tanpa AI)
curl "http://localhost:5000/api/recipes/recommend?ingredients=ayam,bawang&source=js"

# Cek status AI
curl "http://localhost:5000/api/recipes/ai-status"
```

---

## 👥 Tim CC26-PSU127

| Nama | Role |
|------|------|
| Maghfur Hasani | AI Engineer |
| Angelin Viona L.T. | AI Engineer |
| Titania Rahmawati | Data Scientist |
| Yunita Asri P. | Data Scientist |
| Putri Anisa | Full-Stack Web Dev |
| Marita Habibah | Full-Stack Web Dev |
