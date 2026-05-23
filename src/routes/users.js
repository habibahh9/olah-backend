const express = require("express");
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getHistory,
  clearHistory,
  getLovedRecipes,
  markAsCooked,
} = require("../controllers/userController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.get("/history", getHistory);
router.delete("/history", clearHistory);
router.patch("/history/:historyId/cooked", markAsCooked);
router.get("/loved-recipes", getLovedRecipes);

module.exports = router;
