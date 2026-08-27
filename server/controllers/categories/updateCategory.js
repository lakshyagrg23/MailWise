import prisma from '../../prisma.js';

export const updateCategory = async (req, res) => {
    const { userId, categoryName } = req.params;
    const { newCategoryName, newDescription } = req.body || {};

    if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ error: "A valid userId is required" });
    }

    if (!newCategoryName || !newDescription) {
        return res.status(400).json({ error: "Both newCategoryName and newDescription are required" });
    }

    try {
        const parsedUserId = parseInt(userId);

        // Check if the category exists
        const existingCategory = await prisma.categoryPreference.findUnique({
            where: {
                user_id_category_name: {
                    user_id: parsedUserId,
                    category_name: categoryName
                }
            }
        });

        if (!existingCategory) {
            return res.status(404).json({ error: "Category not found" });
        }

        // Update category
        const updated = await prisma.categoryPreference.update({
            where: {
                user_id_category_name: {
                    user_id: parsedUserId,
                    category_name: categoryName
                }
            },
            data: {
                category_name: newCategoryName,
                category_description: newDescription
            }
        });

        return res.json({ message: "Category updated successfully", category: updated });
    } catch (error) {
        console.error("Database update error:", error);
        return res.status(500).json({ error: "Internal server error", details: error.message });
    }
};

export const UpdateCategory = updateCategory;
