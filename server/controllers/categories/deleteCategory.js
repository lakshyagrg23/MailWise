import prisma from '../../prisma.js';

export const deleteCategory = async (req, res) => {
    const { categoryName } = req.params;

    try {
        const deleted = await prisma.categoryPreference.delete({
            where: {
                user_id_category_name: {
                    user_id: req.user.id,
                    category_name: categoryName
                }
            }
        }).catch(() => null);

        if (!deleted) {
            return res.status(404).json({ error: "Category not found or doesn't belong to the user" });
        }

        return res.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("Error deleting category:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
