import pool from '../../db.js';

export const UpdateCategory=async (req, res) => {
    const { userId, categoryName } = req.params;
    const { newCategoryName, newDescription } = req.body;
    console.log("ddd")
    console.log(req)

    console.log("Received update request:", { userId, categoryName, newCategoryName, newDescription });

    try {
        // Validate inputs
        if (!newCategoryName || !newDescription) {
            return res.status(400).json({ error: "Both newCategoryName and newDescription are required" });
        }

        // Check if the category exists
        const existingCategory = await pool.query(
            "SELECT * FROM category_preferences WHERE user_id = $1 AND category_name = $2",
            [userId, categoryName]
        );

        if (existingCategory.rows.length === 0) {
            console.log("Category not found for update.");
            return res.status(404).json({ error: "Category not found" });
        }

        // Update category
        const updatedCategory = await pool.query(
            "UPDATE category_preferences SET category_name = $1, category_description = $2 WHERE user_id = $3 AND category_name = $4 RETURNING *",
            [newCategoryName, newDescription, userId, categoryName]
        );

        console.log("Category updated successfully:", updatedCategory.rows[0]);
        res.json({ message: "Category updated successfully", category: updatedCategory.rows[0] });
    } catch (error) {
        console.error("Database update error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
}