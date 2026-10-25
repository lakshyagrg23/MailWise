import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

const make = (max, windowMs = 60 * 1000) => rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Per-user key (requireAuth runs first); IPv6-safe IP fallback
    keyGenerator: (req) => (req.user?.id ? `u:${req.user.id}` : ipKeyGenerator(req.ip)),
    handler: (req, res) => res.status(429).json({ error: 'Too many requests' })
});

export const aiDraftLimiter = make(20);
export const summarizeLimiter = make(60);
export const syncLimiter = make(30);

// Global per-IP limiter for unauthenticated /auth/* endpoints
export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (req, res) => res.status(429).json({ error: 'Too many requests' })
});
