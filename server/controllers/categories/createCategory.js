import prisma from '../../prisma.js';

export const createCategory = async (req, res) => {
    const { newCategoryName, newDescription } = req.body || {};

    if (!newCategoryName || !newDescription) {
        return res.status(400).json({ error: "Category name and description are required." });
    }

    try {
        const userId = req.user.id;

        const result = await prisma.categoryPreference.create({
            data: {
                user_id: userId,
                category_name: newCategoryName,
                category_description: newDescription
            }
        });

        await prisma.user.update({
            where: { id: userId },
            data: { update: 1 }
        });

        return res.status(201).json({
            id: result.id,
            name: result.category_name,
            title: result.category_description
        });
    } catch (error) {
        console.error("Error creating category:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const InsertnewCat = createCategory;
