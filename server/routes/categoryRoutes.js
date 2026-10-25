import { Router } from "express";
import { getCategories } from "../controllers/categories/getCategories.js";
import { updateCategory } from "../controllers/categories/updateCategory.js";
import { createCategory } from "../controllers/categories/createCategory.js";
import { deleteCategory } from "../controllers/categories/deleteCategory.js";

const router = Router();

// Identity comes from req.user (requireAuth); no userId in the path.
router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:categoryName", updateCategory);
router.delete("/:categoryName", deleteCategory);

export default router;
