import { Router } from "express"
import { DisplayingCategoriesName } from "../controllers/categories/DisplayingCategoriesName.js";
import { UpdateCategory } from "../controllers/categories/UpdateCategory.js";
import { InsertnewCat } from "../controllers/categories/InsertNewCategory.js";
import { deleteCategory } from "../controllers/categories/DeleteCategory.js";

const router=Router();

router.get("/:userId",DisplayingCategoriesName)// for fetching userid to the frontend for displaying category names in side
router.put("/:userId/:categoryName",UpdateCategory)//Update exsisting Categories
router.post("/:userId",InsertnewCat)// Inserting new Categories
router.delete("/:userId/:categoryName",deleteCategory)//Deleting A Existing Cattegory

export default router;