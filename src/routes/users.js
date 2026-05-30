const express = require("express");
const router = express.Router();

const {
  getProfile,
  updateProfile,
  getHistory,
  clearHistory,
  addHistory,
  getLovedRecipes,
  markAsCooked,
  changePassword, 
} = require("../controllers/userController");

const { protect } = require("../middleware/auth");
const { getNotifications } = require("../controllers/notificationController");

router.use(protect);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);

router.put("/change-password", changePassword);

router.get("/history", getHistory);
router.delete("/history", clearHistory);
router.post("/history", addHistory); 
router.patch("/history/:historyId/cooked", markAsCooked);
router.get("/loved-recipes", getLovedRecipes);
router.get("/notifications", getNotifications);

module.exports = router;