import { Router } from "express";
import { asyncHandler as h } from "../../utils/asyncHandler.js";
import { validateIntParam } from "../../utils/params.js";
import { getCategories } from "../../controllers/categories/getCategories.js";
import { createCategory } from "../../controllers/categories/createCategory.js";
import { updateCategory } from "../../controllers/categories/updateCategory.js";
import { deleteCategory } from "../../controllers/categories/deleteCategory.js";

const router = Router();

router.param("categoryId", validateIntParam("Invalid category ID"));

router.get("/", h(getCategories));
router.post("/", h(createCategory));
router.patch("/:categoryId", h(updateCategory));
router.delete("/:categoryId", h(deleteCategory));

export default router;
