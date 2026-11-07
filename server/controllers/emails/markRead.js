import prisma from '../../prisma.js';
import { getAuthenticatedClient } from '../../services/googleAuthService.js';

/**
 * POST /email/read/:emailId  { read?: boolean }  (default true)
 * Updates the local row (scoped to the authenticated user) and mirrors the change to Gmail's
 * UNREAD label. The Gmail call is best-effort: without the gmail.modify scope (user signed in
 * before it was requested) the local state still updates and `gmailSynced` is false.
 */
// Shared by markRead / setStar: update the local flag, then mirror a Gmail label change
const updateFlag = async (req, res, { field, value, addLabel, removeLabel }) => {
    const { emailId } = req.params;
    if (!emailId || emailId.length > 128) {
        return res.status(400).json({ error: 'Invalid email ID' });
    }

    try {
        const result = await prisma.emailMetadata.updateMany({
            where: { user_id: req.user.id, email_id: emailId },
            data: { [field]: value },
        });

        let gmailSynced = false;
        if (result.count > 0 && !req.user.isDemo) {
            try {
                const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: emailId,
                    requestBody: value
                        ? { addLabelIds: addLabel ? [addLabel] : [], removeLabelIds: removeLabel ? [removeLabel] : [] }
                        : { addLabelIds: removeLabel ? [removeLabel] : [], removeLabelIds: addLabel ? [addLabel] : [] },
                });
                gmailSynced = true;
            } catch (gmailErr) {
                console.warn(`[${field}] Gmail label sync skipped for ${emailId}:`, gmailErr.message);
            }
        }

        return res.json({ updated: result.count, gmailSynced });
    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        return res.status(500).json({ error: 'Failed to update email' });
    }
};

/** POST /email/star/:emailId  { starred?: boolean } (default true) */
export const setStar = (req, res) =>
    updateFlag(req, res, {
        field: 'is_starred',
        value: req.body?.starred === false ? false : true,
        addLabel: 'STARRED',
    });

export const markRead = async (req, res) => {
    const { emailId } = req.params;
    if (!emailId || emailId.length > 128) {
        return res.status(400).json({ error: 'Invalid email ID' });
    }
    const read = req.body?.read === false ? false : true;

    try {
        const result = await prisma.emailMetadata.updateMany({
            where: { user_id: req.user.id, email_id: emailId },
            data: { is_read: read },
        });

        let gmailSynced = false;
        if (result.count > 0 && !req.user.isDemo) {
            try {
                const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
                await gmail.users.messages.modify({
                    userId: 'me',
                    id: emailId,
                    requestBody: read ? { removeLabelIds: ['UNREAD'] } : { addLabelIds: ['UNREAD'] },
                });
                gmailSynced = true;
            } catch (gmailErr) {
                console.warn(`[markRead] Gmail label sync skipped for ${emailId}:`, gmailErr.message);
            }
        }

        return res.json({ updated: result.count, gmailSynced });
    } catch (error) {
        console.error('Error updating read state:', error);
        return res.status(500).json({ error: 'Failed to update read state' });
    }
};
