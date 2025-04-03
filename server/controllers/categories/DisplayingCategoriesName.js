import pool from '../../db.js';

export const DisplayingCategoriesName= async (req, res) => {
    const userId = req.params.userId;

    try {
        const result = await pool.query(
            "SELECT category_name AS name, category_description AS title FROM category_preferences WHERE user_id = $1;",
            [userId]
        );

        res.json(result.rows); // Send categories as response
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}