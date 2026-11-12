// Loads .env, then exposes every environment setting the server uses. This is the ONLY module that
// reads process.env: import { env } from '../config/env.js' everywhere else. Because this module
// loads dotenv itself, any module that imports it sees a populated environment regardless of
// import order.
import 'dotenv/config';

const str = (name, fallback = '') => (process.env[name] ?? fallback).trim();

const nodeEnv = str('NODE_ENV', 'development');

export const env = Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(str('PORT', '5000')) || 5000,

    databaseUrl: str('DATABASE_URL'),
    frontendUrl: str('FRONTEND_URL'),

    session: Object.freeze({
        secret: str('SESSION_SECRET'),
        sameSite: str('SESSION_SAMESITE', 'lax').toLowerCase(),
        cookieDomain: str('COOKIE_DOMAIN'),
    }),

    google: Object.freeze({
        clientId: str('GOOGLE_CLIENT_ID'),
        clientSecret: str('GOOGLE_CLIENT_SECRET'),
        redirectUri: str('GOOGLE_REDIRECT_URI'),
    }),

    geminiApiKey: str('GEMINI_API_KEY'),

    pubsub: Object.freeze({
        audience: str('PUBSUB_AUDIENCE'),
        serviceAccountEmail: str('PUBSUB_SERVICE_ACCOUNT_EMAIL'),
    }),
});

// Without these the server cannot work at all (no sessions, no database, no CORS/redirect target).
const REQUIRED = [
    ['SESSION_SECRET', () => env.session.secret.length >= 16, 'SESSION_SECRET (at least 16 characters)'],
    ['DATABASE_URL', () => env.databaseUrl, 'DATABASE_URL'],
    ['FRONTEND_URL', () => env.frontendUrl, 'FRONTEND_URL'],
];

// Features degrade without these (demo mode still works), so they warn instead of blocking boot.
// Move an entry to REQUIRED to make it fatal.
const RECOMMENDED = [
    ['Google sign-in', () => env.google.clientId && env.google.clientSecret && env.google.redirectUri,
        'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI'],
    ['AI classification, summaries and drafts', () => env.geminiApiKey, 'GEMINI_API_KEY'],
];

/** Call once at startup. Throws listing every missing required setting; warns about the rest. */
export const assertEnv = () => {
    const missing = REQUIRED.filter(([, ok]) => !ok()).map(([, , label]) => label);
    if (missing.length) {
        throw new Error(`Missing or invalid environment configuration: ${missing.join(', ')}`);
    }
    for (const [feature, ok, label] of RECOMMENDED) {
        if (!ok()) console.warn(`[config] ${label} not set: ${feature} will not work.`);
    }
};
