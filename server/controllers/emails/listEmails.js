import prisma from '../../lib/prisma.js';

/**
 * GET /api/v1/emails?category=<name>
 * Read-only: returns the user's stored (already classified) emails from PostgreSQL.
 * Pulling new mail from Gmail is a separate, explicit action: POST /api/v1/emails/sync.
 * Omit `category` (or pass "All") for every category.
 */
export const listEmails = async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';

    const where = { user_id: req.user.id };
    // Hide sent mail that was ingested before Sent got its own view
    if (req.user.email) {
        where.NOT = { sender: { contains: req.user.email, mode: 'insensitive' } };
    }
    if (category && category.toLowerCase() !== 'all') {
        where.category = { equals: category, mode: 'insensitive' };
    }

    const rows = await prisma.emailMetadata.findMany({
        where,
        orderBy: { received_date: 'desc' }
    });

    // Internal bookkeeping columns are not part of the API contract
    const emails = rows.map(({ update, user_id, ...email }) => email);
    return res.json({ emails });
};
