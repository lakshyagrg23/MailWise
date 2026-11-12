import prisma from '../../lib/prisma.js';
import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { badRequest, notFound } from '../../utils/http/httpErrors.js';

// API field -> Gmail label, and whether the label is present when the field is true
const FLAGS = {
    is_starred: { label: 'STARRED', presentWhen: true },
    is_read: { label: 'UNREAD', presentWhen: false } // UNREAD label present <=> not read
};

/**
 * PATCH /api/v1/emails/:emailId   { is_read?: boolean, is_starred?: boolean }
 * Updates the local row (scoped to the authenticated user) and mirrors the change to Gmail
 * labels. The Gmail call is best-effort: without the gmail.modify scope (user signed in before
 * it was requested) the local state still updates and `gmailSynced` is false.
 */
export const updateEmail = async (req, res) => {
    const body = req.body || {};
    const data = {};
    for (const field of Object.keys(FLAGS)) {
        if (body[field] === undefined) continue;
        if (typeof body[field] !== 'boolean') throw badRequest(`${field} must be a boolean`);
        data[field] = body[field];
    }
    if (Object.keys(data).length === 0) throw badRequest('Provide is_read and/or is_starred');

    const { emailId } = req.params;
    const result = await prisma.emailMetadata.updateMany({
        where: { user_id: req.user.id, email_id: emailId },
        data,
    });
    if (result.count === 0) throw notFound('Email not found');

    let gmailSynced = false;
    if (!req.user.isDemo) {
        const addLabelIds = [];
        const removeLabelIds = [];
        for (const [field, value] of Object.entries(data)) {
            const { label, presentWhen } = FLAGS[field];
            (value === presentWhen ? addLabelIds : removeLabelIds).push(label);
        }
        try {
            const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
            await gmail.users.messages.modify({
                userId: 'me',
                id: emailId,
                requestBody: { addLabelIds, removeLabelIds },
            });
            gmailSynced = true;
        } catch (gmailErr) {
            console.warn(`[updateEmail] Gmail label sync skipped for ${emailId}:`, gmailErr.message);
        }
    }

    return res.json({ updated: result.count, gmailSynced });
};
