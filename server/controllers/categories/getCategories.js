import prisma from '../../lib/prisma.js';
import { toCategoryDto } from './validate.js';

/** GET /api/v1/categories */
export const getCategories = async (req, res) => {
    const rows = await prisma.categoryPreference.findMany({
        where: { user_id: req.user.id },
        orderBy: { id: 'asc' }
    });
    return res.json(rows.map(toCategoryDto));
};
