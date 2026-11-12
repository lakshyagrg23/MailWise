import { syncUserMailbox } from '../../services/syncService.js';

/**
 * POST /api/v1/emails/sync
 * Pulls new mail from Gmail, classifies it with Gemini and stores it. Has side effects (Gmail,
 * Gemini, database), hence POST. Read the result with GET /api/v1/emails. Resolves to { newEmails }.
 */
export const syncEmails = async (req, res) => {
    // Demo data is seeded at login; there is nothing to pull
    if (req.user.isDemo) return res.json({ newEmails: 0 });

    return res.json(await syncUserMailbox(req.user.id));
};
