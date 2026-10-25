import crypto from 'crypto';

export const SESSION_COOKIE = 'mailwise_session';
export const OAUTH_STATE_COOKIE = 'mailwise_oauth_state';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;

const getSecret = () => {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
        throw new Error('SESSION_SECRET is missing or too short (min 16 chars)');
    }
    return secret;
};

/** Throws if session configuration is invalid. Call at startup. */
export const assertSessionConfig = () => { getSecret(); };

const b64url = (str) => Buffer.from(str).toString('base64url');

const sign = (data) =>
    crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');

const safeEqual = (a, b) => {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
};

export const cookieOptions = (maxAgeMs) => {
    const sameSite = (process.env.SESSION_SAMESITE || 'lax').toLowerCase();
    const opts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' || sameSite === 'none',
        sameSite,
        path: '/',
        maxAge: maxAgeMs
    };
    if (process.env.COOKIE_DOMAIN) opts.domain = process.env.COOKIE_DOMAIN;
    return opts;
};

const clearOptions = () => {
    const { maxAge, ...opts } = cookieOptions(0);
    return opts;
};

export const createSession = (res, userId) => {
    const payload = b64url(JSON.stringify({
        uid: userId,
        exp: Date.now() + SESSION_TTL_MS
    }));
    const token = `${payload}.${sign(payload)}`;
    res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_TTL_MS));
};

export const clearSession = (res) => {
    res.clearCookie(SESSION_COOKIE, clearOptions());
};

/**
 * Verifies a session token. Returns the user id (integer) or null.
 */
export const verifySessionToken = (token) => {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    if (!safeEqual(sig, sign(payload))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!Number.isInteger(data.uid) || typeof data.exp !== 'number' || data.exp < Date.now()) {
            return null;
        }
        return data.uid;
    } catch {
        return null;
    }
};

export const issueOAuthState = (res) => {
    const state = crypto.randomBytes(32).toString('base64url');
    res.cookie(OAUTH_STATE_COOKIE, state, cookieOptions(STATE_TTL_MS));
    return state;
};

/** Verifies req.query.state against the state cookie (constant-time) and clears the cookie. */
export const consumeOAuthState = (req, res) => {
    const expected = req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, clearOptions());
    const received = req.query?.state;
    if (typeof expected !== 'string' || typeof received !== 'string' || !expected) return false;
    return safeEqual(expected, received);
};
