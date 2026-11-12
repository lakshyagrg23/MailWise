import prisma from '../../lib/prisma.js';
import { parseCategoryCreate, toCategoryDto } from '../../validators/category.js';

/** POST /api/v1/categories  { name, description } */
export const createCategory = async (req, res) => {
    const { name, description } = parseCategoryCreate(req.body);

    // A duplicate name raises P2002, which the central error handler maps to 409
    const row = await prisma.categoryPreference.create({
        data: { user_id: req.user.id, category_name: name, category_description: description }
    });

    await prisma.user.update({ where: { id: req.user.id }, data: { update: 1 } });

    return res.status(201).json(toCategoryDto(row));
};
