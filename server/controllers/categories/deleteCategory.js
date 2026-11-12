import prisma from '../../lib/prisma.js';
import { notFound } from '../../utils/http/httpErrors.js';

/** DELETE /api/v1/categories/:categoryId */
export const deleteCategory = async (req, res) => {
    const { count } = await prisma.categoryPreference.deleteMany({
        where: { id: Number(req.params.categoryId), user_id: req.user.id }
    });
    if (count === 0) throw notFound('Category not found');

    return res.status(204).end();
};
