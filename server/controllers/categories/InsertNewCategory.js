import prisma from '../../prisma.js';

export const InsertnewCat= async (req, res) => {
    const { userId } = req.params;
    console.log(userId)
    const { newCategoryName, newDescription } = (req.body);
    console.log("creating new category")

    // Validation: Ensure inputs are not empty
    if (!newCategoryName || !newDescription) {
        return res.status(400).json({ error: "Category name and description are required." });
    }

    try {
        // Insert new category into database
        const result = await prisma.categoryPreference.create({
            data: {
                user_id: parseInt(userId),
                category_name: newCategoryName,
                category_description: newDescription
            }
        });
        await prisma.user.update({
            where: { id: parseInt(userId) },
            data: { update: 1 }
        });

        res.status(201).json({ id: result.id, name: result.category_name, title: result.category_description }); // Return newly created category
    } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}