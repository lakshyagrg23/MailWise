// Import this FIRST in every test file. config/env.js reads process.env once at import, and
// dotenv never overrides variables that are already set, so these win over a local server/.env.
// The database URL points at a closed port: no test here may need a database.
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret-test-secret-123';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/test';
process.env.FRONTEND_URL = 'http://localhost:3000';

import express from 'express';
import { toErrorResponse } from '../utils/http/httpErrors.js';

/** Listens on an ephemeral port. Returns { base, close }. */
export const listen = (app) =>
    new Promise((resolve) => {
        const srv = app.listen(0, () =>
            resolve({
                base: `http://127.0.0.1:${srv.address().port}`,
                close: () => new Promise((r) => srv.close(r)),
            })
        );
    });

/**
 * Mounts routers behind a fake authenticated user (skipping requireAuth, which needs the
 * database) with the same error handler as the real app.
 * mounts: { '/emails': router, ... }
 */
export const appWithUser = (mounts, user = { id: 1, email: 'demo@mailwise.app', isDemo: true }) => {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
        req.user = { ...user };
        next();
    });
    for (const [prefix, router] of Object.entries(mounts)) app.use(prefix, router);
    app.use((err, req, res, next) => {
        const { status, body } = toErrorResponse(err);
        res.status(status).json(body);
    });
    return app;
};

/** fetch helper: resolves to { status, body (parsed JSON when possible), headers }. */
export const call = async (base, method, path, body) => {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json, text, headers: res.headers };
};
