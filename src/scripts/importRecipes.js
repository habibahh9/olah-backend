const mongoose = require('mongoose');
const Recipe = require('../models/Recipe'); // Pastikan path benar
const recipes = require('../data/recipe_metadata.json');
require('dotenv').config();

const importData = async () => {
  try {
    // 1. Koneksi ke Database
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database terhubung...");

    // 2. Hapus data lama agar database tetap bersih (opsional)
    await Recipe.deleteMany({});
    console.log("Data lama dihapus.");

    // 3. Masukkan data baru
    await Recipe.insertMany(recipes);
    console.log("Data berhasil diimpor!");

    process.exit();
  } catch (error) {
    console.error("Error import:", error);
    process.exit(1);
  }
};

importData();