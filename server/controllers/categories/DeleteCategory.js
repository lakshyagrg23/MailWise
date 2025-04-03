import pool from '../../db.js';

export const deleteCategory=async (req, res) => {
    const { userId, categoryName } = req.params;

    try {
        // Ensure the category belongs to the user before deleting
        const deleteQuery = `
            DELETE FROM category_preferences
            WHERE user_id = $1 AND category_name = $2
            RETURNING *;
        `;
        const { rows } = await pool.query(deleteQuery, [userId, categoryName]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Category not found or doesn't belong to the user" });
        }

        res.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}