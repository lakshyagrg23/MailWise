import prisma from '../../prisma.js';

export const deleteCategory=async (req, res) => {
    const { userId, categoryName } = req.params;
    console.log("deleting a category")

    try {
        // Ensure the category belongs to the user before deleting
        const deleted = await prisma.categoryPreference.delete({
            where: {
                user_id_category_name: {
                    user_id: parseInt(userId),
                    category_name: categoryName
                }
            }
        }).catch(() => null);

        if (!deleted) {
            return res.status(404).json({ error: "Category not found or doesn't belong to the user" });
        }

        res.json({ message: "Category deleted successfully" });
        console.log(13)
    } catch (error) {
        console.error("Error deleting category:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}