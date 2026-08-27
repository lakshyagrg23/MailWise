import prisma from '../../prisma.js';

export const createCategory = async (req, res) => {
    const { userId } = req.params;
    const { newCategoryName, newDescription } = req.body || {};

    if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ error: "A valid userId is required." });
    }

    if (!newCategoryName || !newDescription) {
        return res.status(400).json({ error: "Category name and description are required." });
    }

    try {
        const parsedUserId = parseInt(userId);

        const result = await prisma.categoryPreference.create({
            data: {
                user_id: parsedUserId,
                category_name: newCategoryName,
                category_description: newDescription
            }
        });

        await prisma.user.update({
            where: { id: parsedUserId },
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
