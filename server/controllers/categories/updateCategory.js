import prisma from '../../lib/prisma.js';
import { notFound } from '../../utils/http/httpErrors.js';
import { parseCategoryPatch, toCategoryDto } from '../../validators/category.js';

/** PATCH /api/v1/categories/:categoryId  { name?, description? }. Renaming also re-labels the user's stored emails. */
export const updateCategory = async (req, res) => {
    const patch = parseCategoryPatch(req.body);
    const id = Number(req.params.categoryId);

    // One transaction: the category row and the stored emails that carry its name change together,
    // so a rename can never leave mail pointing at a name that no longer exists. Any throw inside
    // (not found, or P2002 when renaming onto an existing name -> 409) rolls everything back.
    const row = await prisma.$transaction(async (tx) => {
        // Scope by owner: a category id belonging to someone else is indistinguishable from missing
        const existing = await tx.categoryPreference.findFirst({ where: { id, user_id: req.user.id } });
        if (!existing) throw notFound('Category not found');

        const updated = await tx.categoryPreference.update({
            where: { id },
            data: {
                ...(patch.name !== undefined && { category_name: patch.name }),
                ...(patch.description !== undefined && { category_description: patch.description })
            }
        });

        if (patch.name !== undefined && patch.name !== existing.category_name) {
            // Case-insensitive, matching how the email list filters by category
            await tx.emailMetadata.updateMany({
                where: { user_id: req.user.id, category: { equals: existing.category_name, mode: 'insensitive' } },
                data: { category: patch.name }
            });
        }

        return updated;
    });

    return res.json(toCategoryDto(row));
};
