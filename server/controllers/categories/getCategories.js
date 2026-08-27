import prisma from '../../prisma.js';

export const getCategories = async (req, res) => {
    const { userId } = req.params;

    if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ error: "A valid userId is required" });
    }

    try {
        const result = await prisma.categoryPreference.findMany({
            where: { user_id: parseInt(userId) },
            select: { category_name: true, category_description: true }
        });

        const formatted = result.map(c => ({ name: c.category_name, title: c.category_description }));
        return res.json(formatted);
    } catch (error) {
        console.error("Error fetching categories:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const DisplayingCategoriesName = getCategories;
