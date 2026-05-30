/**
 * Seed Script - Import recipe_metadata.json ke MongoDB
 * CC26-PSU127 - OLAH
 *
 * Usage:
 *   Letakkan recipe_metadata.json di root folder backend (sejajar server.js)
 *   Jalankan: npm run seed
 *
 *   Path custom: RECIPE_FILE=./data/recipes.json npm run seed
 *   Reset DB dulu: RESET=true npm run seed
 */

require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Recipe = require("../models/Recipe");
const { normalizeIngredient } = require("./ingredientNormalizer");

const recipePath =
  process.env.RECIPE_FILE ||
  path.join(__dirname, "../../recipe_metadata.json");

// ── Mapper: field dari recipe_metadata.json → schema Recipe ──────────────────
// Menangani baik format snake_case (dari Tim AI) maupun camelCase
const mapRecipeData = (raw) => {
  const ingredients = Array.isArray(raw.ingredients)
    ? raw.ingredients.map((i) => String(i).toLowerCase().trim()).filter(Boolean)
    : typeof raw.ingredients_cleaned === "string"
    ? raw.ingredients_cleaned.split(",").map((i) => i.trim().toLowerCase()).filter(Boolean)
    : [];

  const ingredientsNormalized = [
    ...new Set(ingredients.map(normalizeIngredient).filter(Boolean)),
  ];

  return {
    recipeId: raw.recipe_id ?? raw.recipeId,
    recipeName: String(raw.recipe_name ?? raw.recipeName ?? "").trim(),
    category: String(raw.category ?? "umum").toLowerCase().trim(),
    ingredients,
    ingredientsCleaned: raw.ingredients_cleaned ?? raw.ingredientsCleaned ?? ingredients.join(", "),
    ingredientsNormalized,
    totalIngredients: ingredients.length || raw.total_ingredients || raw.totalIngredients || 0,
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    loveCount: raw.love_count ?? raw.loveCount ?? 0,
    url: raw.url ?? null,
    imageUrl: raw.image_url ?? raw.imageUrl ?? null,
  };
};

const seedRecipes = async () => {
  console.log("\nOLAH - Seed Script dimulai...");
  console.log("=".repeat(50));

  if (!fs.existsSync(recipePath)) {
    console.error(`File tidak ditemukan: ${recipePath}`);
    console.log("   Letakkan recipe_metadata.json di root folder backend.");
    process.exit(1);
  }

  let rawData;
  try {
    rawData = fs.readFileSync(recipePath, "utf-8");
  } catch (err) {
    console.error(`Gagal membaca file: ${err.message}`);
    process.exit(1);
  }

  let recipes;
  try {
    const parsed = JSON.parse(rawData);
    if (Array.isArray(parsed)) {
      recipes = parsed;
    } else if (parsed.recipes && Array.isArray(parsed.recipes)) {
      recipes = parsed.recipes;
    } else if (parsed.recipe_id !== undefined) {
      recipes = [parsed];
    } else {
      recipes = Object.values(parsed);
    }
  } catch (err) {
    console.error(`Gagal parse JSON: ${err.message}`);
    process.exit(1);
  }

  console.log(`Ditemukan ${recipes.length} resep di file.`);
  await connectDB();

  // Opsional reset
  if (process.env.RESET === "true") {
    await Recipe.deleteMany({});
    console.log("Database dikosongkan (RESET=true).");
  }

  const existingCount = await Recipe.countDocuments();
  console.log(`Resep di database saat ini: ${existingCount}`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  const operations = [];
  for (const raw of recipes) {
    try {
      if (!raw.recipe_id && !raw.recipeId) {
        console.warn(`Resep tanpa recipe_id dilewati: ${JSON.stringify(raw).slice(0, 80)}`);
        failed++;
        continue;
      }
      const docData = mapRecipeData(raw);
      operations.push({
        updateOne: {
          filter: { recipeId: docData.recipeId },
          update: { $set: docData },
          upsert: true,
        },
      });
    } catch (err) {
      console.warn(`Gagal proses "${raw.recipe_name}": ${err.message}`);
      failed++;
    }
  }

  // Bulk write dalam batch 100
  const BATCH = 100;
  for (let i = 0; i < operations.length; i += BATCH) {
    const batch = operations.slice(i, i + BATCH);
    const result = await Recipe.bulkWrite(batch, { ordered: false });
    inserted += result.upsertedCount || 0;
    updated += result.modifiedCount || 0;
    process.stdout.write(`\r   Memproses ${Math.min(i + BATCH, operations.length)}/${operations.length}...`);
  }

  console.log("\n");
  console.log("Seed selesai!");
  console.log(`Inserted  : ${inserted}`);
  console.log(`Updated   : ${updated}`);
  console.log(`Failed    : ${failed}`);
  console.log(`Total DB  : ${await Recipe.countDocuments()}`);
  console.log("=".repeat(50));

  await mongoose.disconnect();
  console.log("MongoDB disconnected.\n");
  process.exit(0);
};

seedRecipes().catch((err) => {
  console.error("Seed gagal:", err.message);
  process.exit(1);
});
