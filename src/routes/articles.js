const express = require("express");
const router = express.Router();
const { getArticles } = require("../controllers/articlesController");

router.get("/", getArticles);

module.exports = router;