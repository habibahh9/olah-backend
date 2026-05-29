/**
 * Utility untuk normalisasi dan matching bahan makanan Indonesia
 * Menangani variasi penulisan, sinonim, dan typo umum
 * CC26-PSU127 - OLAH
 */

// ── Kamus Sinonim Bahan Makanan Indonesia ─────────────────────────────────────
const SYNONYMS = {
  // Protein
  telur: ["telor", "telor ayam", "telur ayam", "egg"],
  "daging sapi": ["daging sapi", "sapi", "beef"],
  "daging ayam": ["daging ayam", "ayam", "chicken", "fillet ayam"],
  "daging kambing": ["daging kambing", "kambing", "mutton"],
  udang: ["udang", "shrimp", "prawn"],
  ikan: ["ikan", "fish"],
  tahu: ["tahu", "tofu"],
  tempe: ["tempe", "tempeh"],

  // Bumbu dasar
  bawang: ["bawang", "onion"],
  "bawang merah": ["bawang merah", "red onion", "shallot"],
  "bawang putih": ["bawang putih", "garlic", "bawang pute"],
  "bawang bombay": ["bawang bombay", "bombay", "onion besar"],
  cabai: ["cabai", "cabe", "chili", "cili", "lombok"],
  "cabai merah": ["cabai merah", "cabe merah", "lombok merah"],
  "cabai rawit": ["cabai rawit", "cabe rawit", "cabe ceplik", "rawit"],
  jahe: ["jahe", "ginger"],
  kunyit: ["kunyit", "kunir", "turmeric"],
  lengkuas: ["lengkuas", "laos", "galangal"],
  serai: ["serai", "sereh", "lemongrass"],
  "daun salam": ["daun salam", "salam", "bay leaf"],
  "daun jeruk": ["daun jeruk", "daun jeruk purut", "kaffir lime leaf"],
  kemiri: ["kemiri", "candlenut"],
  ketumbar: ["ketumbar", "coriander", "coriander seed"],
  jintan: ["jintan", "cumin"],
  pala: ["pala", "nutmeg"],
  merica: ["merica", "lada", "pepper", "black pepper", "lada hitam"],
  "lada hitam": ["lada hitam", "merica hitam", "black pepper"],

  // Bumbu jadi
  kecap: ["kecap", "kecap manis"],
  "kecap manis": ["kecap manis", "sweet soy sauce"],
  "kecap asin": ["kecap asin", "soy sauce"],
  "saus tiram": ["saus tiram", "oyster sauce"],
  "terasi": ["terasi", "belacan", "shrimp paste"],
  "saus sambal": ["saus sambal", "sambal botol"],

  // Sayuran
  wortel: ["wortel", "carrot", "wortels"],
  kentang: ["kentang", "potato"],
  tomat: ["tomat", "tomato"],
  bayam: ["bayam", "spinach"],
  kangkung: ["kangkung", "water spinach"],
  "kacang panjang": ["kacang panjang", "long bean"],
  "buncis": ["buncis", "green bean"],
  terong: ["terong", "terung", "eggplant", "aubergine"],
  timun: ["timun", "ketimun", "cucumber"],
  kol: ["kol", "kubis", "cabbage"],
  sawi: ["sawi", "mustard green"],

  // Karbohidrat
  beras: ["beras", "rice"],
  nasi: ["nasi", "cooked rice"],
  mie: ["mie", "mi", "noodle", "mie telur"],
  tepung: ["tepung", "flour"],
  "tepung terigu": ["tepung terigu", "terigu", "wheat flour"],
  "tepung beras": ["tepung beras", "rice flour"],

  // Santan & Susu
  santan: ["santan", "coconut milk", "santan kental", "santan cair"],
  susu: ["susu", "milk"],

  // Minyak
  minyak: ["minyak", "oil", "minyak goreng", "cooking oil"],
  "minyak kelapa": ["minyak kelapa", "coconut oil"],
  "minyak wijen": ["minyak wijen", "sesame oil"],

  // Bumbu pelengkap
  garam: ["garam", "salt"],
  gula: ["gula", "sugar", "gula pasir"],
  "gula merah": ["gula merah", "gula jawa", "palm sugar", "brown sugar"],
  "gula pasir": ["gula pasir", "gula", "white sugar"],
  "air": ["air", "water"],

  // Asam-asaman
  "jeruk nipis": ["jeruk nipis", "lime", "limau"],
  "jeruk lemon": ["jeruk lemon", "lemon"],
  asam: ["asam", "asam jawa", "tamarind"],
  cuka: ["cuka", "vinegar"],

  // Daun-daunan
  "daun bawang": ["daun bawang", "scallion", "green onion", "spring onion"],
  "daun seledri": ["daun seledri", "seledri", "celery"],
  "daun ketumbar": ["daun ketumbar", "cilantro", "coriander leaf"],
  "daun pandan": ["daun pandan", "pandan"],
  "daun kemangi": ["daun kemangi", "kemangi", "basil"],

  // Kacang-kacangan
  kacang: ["kacang", "peanut", "kacang tanah"],
  "kacang tanah": ["kacang tanah", "peanut"],
  "kacang merah": ["kacang merah", "red bean", "kidney bean"],
  "kacang hijau": ["kacang hijau", "mung bean"],

  // Bumbu halus umum
  "bumbu halus": ["bumbu halus", "bumbu", "spice paste"],
};

// ── Bangun reverse lookup (alias → canonical) ─────────────────────────────────
const buildReverseMap = () => {
  const map = {};
  for (const [canonical, aliases] of Object.entries(SYNONYMS)) {
    for (const alias of aliases) {
      map[alias.toLowerCase().trim()] = canonical;
    }
  }
  return map;
};

const REVERSE_MAP = buildReverseMap();

// ── Fungsi normalisasi satu bahan ─────────────────────────────────────────────
const normalizeIngredient = (ingredient) => {
  if (!ingredient) return "";
  let normalized = ingredient
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    // Hapus angka dan satuan di depan bahan (e.g. "2 siung bawang putih" → "bawang putih")
    .replace(/^\d+[\d./]*\s*(gram|gr|kg|ml|liter|sdm|sdt|buah|siung|lembar|batang|ruas|biji|butir|ekor|iris|helai|sachet|bungkus|cup|cc)?\s*/i, "")
    // Hapus keterangan tambahan dalam kurung
    .replace(/\s*\(.*?\)/g, "")
    .trim();

  // Cek apakah ada di reverse map (alias → canonical)
  if (REVERSE_MAP[normalized]) {
    return REVERSE_MAP[normalized];
  }

  // Cek partial match di reverse map
  for (const [alias, canonical] of Object.entries(REVERSE_MAP)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      if (normalized.length > 2 && alias.length > 2) {
        return canonical;
      }
    }
  }

  return normalized;
};

// ── Fungsi normalisasi array bahan ────────────────────────────────────────────
const normalizeIngredients = (ingredients) => {
  return [...new Set(ingredients.map(normalizeIngredient).filter(Boolean))];
};

// ── Fungsi: hitung similarity antara dua bahan (fuzzy match) ─────────────────
const ingredientSimilarity = (a, b) => {
  a = normalizeIngredient(a);
  b = normalizeIngredient(b);
  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;
  return 0;
};

// ── Fungsi utama: hitung match score antara pantry user dan bahan resep ───────
/**
 * @param {string[]} userIngredients - Bahan yang dimiliki user (dari pantry)
 * @param {string[]} recipeIngredients - Bahan yang dibutuhkan resep
 * @returns {{ matchCount, matchedIngredients, missingIngredients, matchScore, coveragePercent }}
 */
const calculateMatchScore = (userIngredients, recipeIngredients) => {
  if (!recipeIngredients || recipeIngredients.length === 0) {
    return {
      matchCount: 0,
      matchedIngredients: [],
      missingIngredients: [],
      matchScore: 0,
      coveragePercent: 0,
    };
  }

  const normalizedUser = normalizeIngredients(userIngredients);
  const normalizedRecipe = recipeIngredients.map(normalizeIngredient);

  const matchedIngredients = [];
  const missingIngredients = [];

  for (const recipeIng of normalizedRecipe) {
    let matched = false;
    for (const userIng of normalizedUser) {
      const sim = ingredientSimilarity(recipeIng, userIng);
      if (sim >= 0.8) {
        matched = true;
        break;
      }
    }
    if (matched) {
      matchedIngredients.push(recipeIng);
    } else {
      missingIngredients.push(recipeIng);
    }
  }

  const matchCount = matchedIngredients.length;
  const total = normalizedRecipe.length;

  // Score: kombinasi coverage + penalti untuk resep yang butuh banyak bahan missing
  const coveragePercent = total > 0 ? (matchCount / total) * 100 : 0;
  
  // Bonus untuk resep dengan total bahan sedikit (lebih mudah dibuat)
  const simplicityBonus = Math.max(0, (20 - total) / 20) * 10;
  
  const matchScore = coveragePercent + simplicityBonus;

  return {
    matchCount,
    matchedIngredients,
    missingIngredients,
    matchScore: Math.round(matchScore * 100) / 100,
    coveragePercent: Math.round(coveragePercent * 10) / 10,
  };
};

// ── Rule-based fallback: kategori bahan utama ────────────────────────────────
const getMainIngredientCategory = (ingredients) => {
  const normalized = normalizeIngredients(ingredients);
  const categories = {
    ayam: ["daging ayam", "ayam"],
    sapi: ["daging sapi", "sapi"],
    ikan: ["ikan", "udang", "cumi"],
    tahu_tempe: ["tahu", "tempe"],
    sayuran: ["bayam", "kangkung", "wortel", "kentang", "sayuran"],
    telur: ["telur"],
  };

  for (const [cat, keywords] of Object.entries(categories)) {
    if (keywords.some((k) => normalized.includes(k))) return cat;
  }
  return "umum";
};

module.exports = {
  normalizeIngredient,
  normalizeIngredients,
  calculateMatchScore,
  getMainIngredientCategory,
  SYNONYMS,
};
