import prisma from '../../prisma.js';

export const DisplayingCategoriesName= async (req, res) => {
    const userId = req.params.userId;

    try {
        const result = await prisma.categoryPreference.findMany({
            where: { user_id: parseInt(userId) },
            select: { category_name: true, category_description: true }
        });

        const formatted = result.map(c => ({ name: c.category_name, title: c.category_description }));
        res.json(formatted); // Send categories as response
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}