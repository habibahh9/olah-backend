/**
 * OLAH AI Service Client
 * Handles communication with the Python FastAPI (Tim AI - port 8000)
 * CC26-PSU127
 *
 * Semua call ke FastAPI di-wrap di sini.
 * Jika AI service tidak tersedia → lempar error agar controller bisa fallback ke JS engine.
 */

const fetch = require("node-fetch");

const AI_BASE_URL = process.env.AI_MODEL_URL || "http://localhost:8000";
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || "8000");

// ── Helper: fetch dengan timeout ──────────────────────────────────────────────
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error(`AI service timeout setelah ${AI_TIMEOUT_MS}ms`);
    }
    throw err;
  }
};

// ── Cek status AI service ─────────────────────────────────────────────────────
const checkHealth = async () => {
  try {
    const res = await fetchWithTimeout(`${AI_BASE_URL}/health`);
    if (!res.ok) return { ok: false, data: null };
    const data = await res.json();
    return { ok: data.model_loaded === true, data };
  } catch {
    return { ok: false, data: null };
  }
};

// ── POST /recommend → FastAPI ─────────────────────────────────────────────────
/**
 * @param {string[]} ingredients  - Bahan dari user
 * @param {object}  options
 * @param {number}  options.top_k
 * @param {string}  options.category_filter
 * @param {number}  options.min_similarity
 * @returns {object} Response dari FastAPI
 */
const getAIRecommendations = async (ingredients, options = {}) => {
  const payload = {
    ingredients,
    top_k: options.top_k || 10,
    min_similarity: options.min_similarity ?? 0.1,
    ...(options.category_filter && { category_filter: options.category_filter }),
  };

  const res = await fetchWithTimeout(`${AI_BASE_URL}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`AI service error ${res.status}: ${errBody}`);
  }

  return res.json();
};

// ── POST /similar → FastAPI ───────────────────────────────────────────────────
/**
 * @param {string} recipeName
 * @param {number} top_k
 */
const getAISimilarRecipes = async (recipeName, top_k = 5) => {
  const res = await fetchWithTimeout(`${AI_BASE_URL}/similar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipe_name: recipeName, top_k }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`AI service error ${res.status}: ${errBody}`);
  }

  return res.json();
};

// ── GET /recipe/popular → FastAPI ─────────────────────────────────────────────
const getAIPopular = async (n = 10, category = null) => {
  let url = `${AI_BASE_URL}/recipe/popular?n=${n}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`AI service error ${res.status}`);
  return res.json();
};

// ── GET /recipe/random → FastAPI ──────────────────────────────────────────────
const getAIRandom = async (n = 10, category = null) => {
  let url = `${AI_BASE_URL}/recipe/random?n=${n}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`AI service error ${res.status}`);
  return res.json();
};

// ── GET /categories → FastAPI ─────────────────────────────────────────────────
const getAICategories = async () => {
  const res = await fetchWithTimeout(`${AI_BASE_URL}/categories`);
  if (!res.ok) throw new Error(`AI service error ${res.status}`);
  return res.json();
};

module.exports = {
  AI_BASE_URL,
  checkHealth,
  getAIRecommendations,
  getAISimilarRecipes,
  getAIPopular,
  getAIRandom,
  getAICategories,
};
