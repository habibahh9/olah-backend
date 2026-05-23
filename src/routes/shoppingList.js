const express = require("express");
const router = express.Router();
const {
  getShoppingList,
  addToShoppingList,
  updateShoppingItem,
  toggleShoppingItem,
  removeShoppingItem,
  clearCheckedItems,
  addMissingIngredientsToList,
} = require("../controllers/shoppingListController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.get("/", getShoppingList);
router.post("/", addToShoppingList);
router.post("/from-recipe", addMissingIngredientsToList);
router.put("/:itemId", updateShoppingItem);
router.patch("/:itemId/toggle", toggleShoppingItem);
router.delete("/clear-checked", clearCheckedItems);
router.delete("/:itemId", removeShoppingItem);

module.exports = router;
