import prisma from '../../prisma.js';

export const UpdateCategory=async (req, res) => {
    const { userId, categoryName } = req.params;
    const { newCategoryName, newDescription } = req.body;
    console.log(req.body)

    console.log("Received update request:", { userId, categoryName, newCategoryName, newDescription });

    try {
        // Validate inputs
        if (!newCategoryName || !newDescription) {
            return res.status(400).json({ error: "Both newCategoryName and newDescription are required" });
        }

        // Check if the category exists
        const existingCategory = await prisma.categoryPreference.findUnique({
            where: {
                user_id_category_name: {
                    user_id: parseInt(userId),
                    category_name: categoryName
                }
            }
        });

        if (!existingCategory) {
            console.log("Category not found for update.");
            return res.status(404).json({ error: "Category not found" });
        }

        // Update category
        const updatedCategory = await prisma.categoryPreference.update({
            where: {
                user_id_category_name: {
                    user_id: parseInt(userId),
                    category_name: categoryName
                }
            },
            data: {
                category_name: newCategoryName,
                category_description: newDescription
            }
        });

        console.log("Category updated successfully:", updatedCategory);
        res.json({ message: "Category updated successfully", category: updatedCategory });
    } catch (error) {
        console.error("Database update error:", error);
        res.status(500).json({ error: "Internal server error", details: error.message });
    }
}