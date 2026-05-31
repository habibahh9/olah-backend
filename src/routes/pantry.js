const express = require("express");
const router = express.Router();
const {
  getPantry,
  addToPantry,
  updatePantryItem,
  removeFromPantry,
  clearPantry,
  getExpiringItems,
  markUsed,  
  getStats, 
} = require("../controllers/pantryController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/",           getPantry);
router.get("/stats",      getStats);      
router.get("/expiring",   getExpiringItems);
router.post("/",          addToPantry);
router.put("/:itemId",    updatePantryItem);
router.patch("/:itemId/use", markUsed);  
router.delete("/clear",   clearPantry);
router.delete("/:itemId", removeFromPantry);

module.exports = router;