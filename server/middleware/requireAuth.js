import prisma from '../prisma.js';
import { SESSION_COOKIE, verifySessionToken } from '../utils/session.js';

export const DEMO_GOOGLE_ID = 'demo_google_id';

/**
 * Identity comes ONLY from the signed session cookie.
 * Never read user_id / access_token from query, body or params for identity.
 */
export const requireAuth = async (req, res, next) => {
    try {
        const userId = verifySessionToken(req.cookies?.[SESSION_COOKIE]);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, google_id: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        req.user = { id: user.id, isDemo: user.google_id === DEMO_GOOGLE_ID };
        return next();
    } catch (error) {
        console.error('requireAuth error:', error.message);
        return res.status(401).json({ error: 'Unauthorized' });
    }
};
