const axios = require("axios");

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_URL = "https://newsapi.org/v2/everything";

const getArticles = async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const q = "(food waste OR food loss OR food spoilage OR waste management OR sustainability OR food rescue OR zero waste)";

    // Hanya melakukan request satu kali
    const response = await axios.get(NEWS_API_URL, {
      params: {
        q,
        language: "id",
        sortBy: "publishedAt",
        page,
        pageSize,
        apiKey: NEWS_API_KEY,
      },
    });

    // Mengambil data artikel dari response.data.articles
    const articles = response.data.articles;

    res.status(200).json({
      success: true,
      data: {
        articles,
        total: response.data.totalResults,
      },
    });
  } catch (error) {
    console.error("getArticles error:", error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil artikel.",
    });
  }
};

module.exports = { getArticles };