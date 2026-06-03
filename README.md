# 🍳 OLAH — Backend

**Coding Camp 2026 powered by DBS Foundation | CC26-PSU127**

> "Punya sisa bahan makanan? di-OLAH aja!"

Backend API untuk aplikasi Olah — sistem rekomendasi resep berbasis AI yang membantu pengguna mengolah sisa bahan makanan menjadi masakan lezat.

---

## 🛠️ Tech Stack
- **Node.js** + Express.js
- **MongoDB Atlas** + Mongoose
- **JWT** untuk autentikasi
- **Axios** untuk komunikasi ke FastAPI (Tim AI)

---

## 🏗️ Arsitektur
React Frontend (Vite, port 5173)
│
▼
Express.js Backend (port 5000)     ← Repo ini
│
├─ [Primary]──► FastAPI AI (port 8000)    ← Tim AI
│                 • POST /recommend
│                 • POST /similar
│                 • GET  /recipe/popular
│                 • GET  /recipe/random
│
└─ [Fallback]──► MongoDB Atlas
---

## 📁 Struktur Folder
olah-backend/
├── server.js
├── app.js
├── src/
│   ├── config/          # Koneksi database
│   ├── controllers/     # Logic handler tiap fitur
│   ├── middleware/      # JWT auth middleware
│   ├── middlewares/
│   ├── models/          # Mongoose schema (User, Recipe)
│   ├── routes/          # Definisi endpoint API
│   ├── scripts/
│   ├── services/
│   └── utils/           # AI client, ingredient normalizer, seeder
├── .env.example
└── package.json

---

## ⚙️ Petunjuk Setup Environment

### Prerequisites
- Node.js 18+
- npm
- MongoDB Atlas account

### Variabel Environment

Buat file `.env` berdasarkan `.env.example`:

```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/olah_db
JWT_SECRET=kunci_panjang_rahasia_disini
CLIENT_URL=http://localhost:5173
PORT=5000

# URL FastAPI dari Tim AI
AI_MODEL_URL=http://localhost:8000
AI_TIMEOUT_MS=8000
```

### Instalasi & Menjalankan Aplikasi

```bash
# Clone repository
git clone https://github.com/habibahh9/olah-backend.git
cd olah-backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env sesuai kebutuhan

# Jalankan development server
npm run dev

# Jalankan production
npm start
```

Server berjalan di `http://localhost:5000`

### Seed Data Resep ke MongoDB

```bash
# Letakkan recipe_metadata.json di root folder, lalu:
npm run seed

# Reset database lalu seed ulang:
RESET=true npm run seed
```

---

## 🤖 Model Machine Learning

Model AI dikelola oleh Tim AI (FastAPI service terpisah). Backend ini berperan sebagai proxy ke FastAPI dan menyediakan fallback JS jika AI service tidak tersedia.

**Urutan prioritas rekomendasi:**
1. Panggil FastAPI AI → jika berhasil, kembalikan hasil ke frontend
2. Jika gagal (timeout/down) → gunakan JS fallback engine (MongoDB + ingredient matching)

**Cek status AI:**
GET /api/recipes/ai-status

> Tautan model ML mengikuti deployment Tim AI — lihat repository AI untuk detailnya.

---

## 🔗 Repository Terkait
- [olah-frontend](https://github.com/habibahh9/olah-frontend) — React Frontend

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