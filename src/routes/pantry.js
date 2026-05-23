const express = require("express");
const router = express.Router();
const {
  getPantry,
  addToPantry,
  updatePantryItem,
  removeFromPantry,
  clearPantry,
  getExpiringItems,
} = require("../controllers/pantryController");
const { protect } = require("../middleware/auth");

// Semua route pantry butuh login
router.use(protect);

router.get("/", getPantry);
router.get("/expiring", getExpiringItems);
router.post("/", addToPantry);
router.put("/:itemId", updatePantryItem);
router.delete("/clear", clearPantry);
router.delete("/:itemId", removeFromPantry);

module.exports = router;
