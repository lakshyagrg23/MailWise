import { Router } from "express";
import { getCategories } from "../controllers/categories/getCategories.js";
import { updateCategory } from "../controllers/categories/updateCategory.js";
import { createCategory } from "../controllers/categories/createCategory.js";
import { deleteCategory } from "../controllers/categories/deleteCategory.js";

const router = Router();

router.get("/:userId", getCategories);
router.put("/:userId/:categoryName", updateCategory);
router.post("/:userId", createCategory);
router.delete("/:userId/:categoryName", deleteCategory);

export default router;
