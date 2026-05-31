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
  requestOtp,
} = require("../controllers/userController");

const { protect } = require("../middleware/auth");
const {
  getNotifications,
  dismissNotification, 
  resetDismissed,     
} = require("../controllers/notificationController");

router.use(protect);

router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/request-otp", requestOtp); 
router.put("/change-password", changePassword);

router.get("/history", getHistory);
router.delete("/history", clearHistory);
router.post("/history", addHistory); 
router.patch("/history/:historyId/cooked", markAsCooked);
router.get("/loved-recipes", getLovedRecipes);
router.get("/notifications", getNotifications);
router.post("/notifications/dismiss", dismissNotification); 
router.delete("/notifications/dismiss", resetDismissed);

module.exports = router;