import { listen, appWithUser, call } from './setup.js';
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import emailRoutes from '../routes/v1/emailRoutes.js';
import sentRoutes from '../routes/v1/sentRoutes.js';
import draftRoutes from '../routes/v1/draftRoutes.js';
import categoryRoutes from '../routes/v1/categoryRoutes.js';
import aiRoutes from '../routes/v1/aiRoutes.js';

describe('real app (no session)', () => {
    let srv;
    before(async () => { srv = await listen(createApp()); });
    after(() => srv.close());

    test('health and JSON 404', async () => {
        assert.deepEqual((await call(srv.base, 'GET', '/health')).body, { status: 'ok' });
        const nope = await call(srv.base, 'GET', '/nope');
        assert.equal(nope.status, 404);
        assert.deepEqual(nope.body, { error: 'Not found' });
    });

    test('every /api/v1 route requires a session', async () => {
        for (const [m, p] of [
            ['GET', '/api/v1/emails'], ['POST', '/api/v1/emails/sync'], ['POST', '/api/v1/emails/send'],
            ['GET', '/api/v1/emails/abc'], ['PATCH', '/api/v1/emails/abc'], ['POST', '/api/v1/emails/abc/summary'],
            ['GET', '/api/v1/emails/abc/attachments/1'], ['GET', '/api/v1/sent'], ['GET', '/api/v1/drafts'],
            ['POST', '/api/v1/drafts'], ['PUT', '/api/v1/drafts/x'], ['DELETE', '/api/v1/drafts/x'],
            ['GET', '/api/v1/categories'], ['POST', '/api/v1/categories'], ['PATCH', '/api/v1/categories/1'],
            ['DELETE', '/api/v1/categories/1'], ['POST', '/api/v1/ai/compose'], ['GET', '/auth/me'],
        ]) {
            assert.equal((await call(srv.base, m, p, m === 'GET' ? undefined : {})).status, 401, `${m} ${p}`);
        }
    });

    test('the pre-restructure paths are gone', async () => {
        for (const [m, p] of [
            ['GET', '/fetch-emails/All'], ['GET', '/fetch-email/abc'], ['POST', '/email/send-emails'],
            ['GET', '/email/summarize/abc'], ['GET', '/categories'], ['GET', '/auth/demo'],
        ]) {
            const r = await call(srv.base, m, p);
            assert.notEqual(r.status, 200, `${m} ${p}`);
        }
        assert.equal((await call(srv.base, 'GET', '/auth/demo')).status, 404, 'demo login is POST only');
    });

    test('malformed JSON is a 400, not a 500', async () => {
        const res = await fetch(`${srv.base}/auth/logout`, {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad',
        });
        assert.equal(res.status, 400);
    });
});

describe('v1 routers with a demo user (validation + demo behaviour)', () => {
    let srv;
    before(async () => {
        srv = await listen(appWithUser({
            '/emails': emailRoutes, '/sent': sentRoutes, '/drafts': draftRoutes,
            '/categories': categoryRoutes, '/ai': aiRoutes,
        }));
    });
    after(() => srv.close());
    const req = (m, p, b) => call(srv.base, m, p, b);

    test('PATCH /emails/:id validates its body and id', async () => {
        assert.equal((await req('PATCH', '/emails/abc', {})).status, 400);
        assert.equal((await req('PATCH', '/emails/abc', { is_read: 'yes' })).status, 400);
        assert.equal((await req('PATCH', '/emails/a%20b', { is_read: true })).status, 400);
        assert.equal((await req('GET', '/emails/bad%2Fid')).status, 400);
    });

    test('sync, send and summary short-circuit for the demo user', async () => {
        assert.deepEqual((await req('POST', '/emails/sync')).body, { newEmails: 0 });
        assert.equal((await req('POST', '/emails/send', { to: 'a@b.com' })).status, 200);
        const s = await req('POST', '/emails/abc/summary');
        assert.equal(s.status, 200);
        assert.ok(s.body.summary.includes('•'));
        assert.equal((await req('GET', '/emails/abc/summary')).status, 404, 'summary is POST only');
    });

    test('attachment route validates partId and 404s for demo mail', async () => {
        assert.equal((await req('GET', '/emails/abc/attachments/1')).status, 404);
        assert.equal((await req('GET', '/emails/abc/attachments/1.2')).status, 404);
        for (const bad of ['x', '1..2', '1%2F2']) {
            assert.equal((await req('GET', `/emails/abc/attachments/${bad}`)).status, 400, bad);
        }
    });

    test('drafts: create is 201, update 200, bad ids 400', async () => {
        assert.equal((await req('POST', '/drafts', { to: 'a@b.com' })).status, 201);
        assert.equal((await req('PUT', '/drafts/xyz', { to: 'a@b.com' })).status, 200);
        assert.equal((await req('PUT', '/drafts/x$z', {})).status, 400);
        assert.deepEqual((await req('DELETE', '/drafts/xyz')).body, { deleted: true });
        const list = await req('GET', '/drafts');
        assert.equal(list.status, 200);
        assert.ok(Array.isArray(list.body.emails));
    });

    test('sent list is served for demo', async () => {
        const r = await req('GET', '/sent');
        assert.equal(r.status, 200);
        assert.equal(r.body.emails[0].is_sent, true);
    });

    test('categories validate input before touching the database', async () => {
        assert.equal((await req('POST', '/categories', { name: 'Sent', description: 'x' })).body.code, 'reserved_name');
        assert.equal((await req('POST', '/categories', { name: ' ', description: 'x' })).status, 400);
        assert.equal((await req('PATCH', '/categories/abc', { name: 'X' })).status, 400);
        assert.equal((await req('PATCH', '/categories/0', { name: 'X' })).status, 400);
        assert.equal((await req('PATCH', '/categories/5', {})).status, 400);
    });

    test('AI compose validates input', async () => {
        assert.equal((await req('POST', '/ai/compose', { details: '' })).status, 400);
        assert.equal((await req('POST', '/ai/compose', { details: 'hi', type: 'rude' })).status, 400);
        const demo = await req('POST', '/ai/compose', { details: 'ask for a day off' });
        assert.equal(demo.status, 200);
        assert.equal(typeof demo.body.subject, 'string');
    });
});
