import { badRequest } from '../../utils/httpErrors.js';
import { isReservedCategoryName, MAX_CATEGORY_NAME, MAX_CATEGORY_DESCRIPTION } from '../../utils/categories.js';

const cleanName = (raw) => {
    if (typeof raw !== 'string' || !raw.trim()) throw badRequest('name must be a non-empty string');
    const name = raw.trim();
    if (name.length > MAX_CATEGORY_NAME) throw badRequest(`name must be at most ${MAX_CATEGORY_NAME} characters`);
    if (isReservedCategoryName(name)) throw badRequest(`"${name}" is a reserved name`, 'reserved_name');
    return name;
};

const cleanDescription = (raw) => {
    if (typeof raw !== 'string' || !raw.trim()) throw badRequest('description must be a non-empty string');
    const description = raw.trim();
    if (description.length > MAX_CATEGORY_DESCRIPTION) {
        throw badRequest(`description must be at most ${MAX_CATEGORY_DESCRIPTION} characters`);
    }
    return description;
};

/** Create: both fields required. Throws HttpError(400). */
export const parseCategoryCreate = (body) => ({
    name: cleanName(body?.name),
    description: cleanDescription(body?.description)
});

/** Update (PATCH): at least one of name / description. Returns only the fields provided. */
export const parseCategoryPatch = (body) => {
    const data = {};
    if (body?.name !== undefined) data.name = cleanName(body.name);
    if (body?.description !== undefined) data.description = cleanDescription(body.description);
    if (Object.keys(data).length === 0) throw badRequest('Provide name and/or description');
    return data;
};

/** DB row -> API shape */
export const toCategoryDto = (row) => ({
    id: row.id,
    name: row.category_name,
    description: row.category_description
});
