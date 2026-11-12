import './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    collectAttachments,
    findAttachmentPart,
    safeContentType,
    attachmentDisposition,
} from '../utils/gmail/attachments.js';
import { toErrorResponse, HttpError, badRequest, notFound, conflict } from '../utils/http/httpErrors.js';
import { EMAIL_ID_RE, DRAFT_ID_RE, PART_ID_RE } from '../utils/http/params.js';
import { isReservedCategoryName } from '../config/categories.js';
import { parseCategoryCreate, parseCategoryPatch, toCategoryDto } from '../validators/category.js';
import { verifySessionToken, createSession } from '../utils/session.js';

// multipart/mixed > [ alternative > [plain, html], pdf (by id), nested mixed > [ small inline txt ] ]
const payload = {
    partId: '', mimeType: 'multipart/mixed', filename: '', body: { size: 0 }, parts: [
        { partId: '0', mimeType: 'multipart/alternative', filename: '', body: { size: 0 }, parts: [
            { partId: '0.0', mimeType: 'text/plain', filename: '', body: { size: 5, data: 'aGVsbG8' } },
            { partId: '0.1', mimeType: 'text/html', filename: '', body: { size: 9, data: 'PGI-aGk8L2I-' } },
        ] },
        { partId: '1', mimeType: 'application/pdf', filename: 'Q3 report.pdf', body: { attachmentId: 'ANGjdJ_x', size: 1234 } },
        { partId: '2', mimeType: 'multipart/mixed', filename: '', body: { size: 0 }, parts: [
            { partId: '2.0', mimeType: 'text/plain', filename: 'note.txt', body: { size: 3, data: 'aGk' } },
        ] },
    ],
};

test('collectAttachments walks nested multiparts and returns metadata only', () => {
    assert.deepEqual(collectAttachments(payload), [
        { partId: '1', filename: 'Q3 report.pdf', mimeType: 'application/pdf', size: 1234 },
        { partId: '2.0', filename: 'note.txt', mimeType: 'text/plain', size: 3 },
    ]);
    assert.deepEqual(collectAttachments(null), []);
});

test('findAttachmentPart only returns real attachments', () => {
    assert.equal(findAttachmentPart(payload, '2.0').filename, 'note.txt');
    assert.equal(findAttachmentPart(payload, '0.0'), null, 'body text is not an attachment');
    assert.equal(findAttachmentPart(payload, '9'), null);
});

test('attachment headers cannot be injected into', () => {
    assert.equal(safeContentType('application/pdf'), 'application/pdf');
    assert.equal(safeContentType('text/html\r\nSet-Cookie: x=1'), 'application/octet-stream');
    assert.equal(safeContentType(undefined), 'application/octet-stream');
    const d = attachmentDisposition('ré"port\r\nX-Evil: 1/../a.pdf');
    assert.ok(!/[\r\n]/.test(d));
    assert.ok(d.startsWith('attachment;'), 'always a forced download');
});

test('toErrorResponse maps known errors and hides unknown ones', () => {
    assert.deepEqual(toErrorResponse(badRequest('nope')), { status: 400, body: { error: 'nope' } });
    assert.deepEqual(toErrorResponse(notFound('gone')), { status: 404, body: { error: 'gone' } });
    assert.equal(toErrorResponse(conflict('dup')).status, 409);
    assert.deepEqual(toErrorResponse(new HttpError(400, 'x', 'reserved_name')).body, { error: 'x', code: 'reserved_name' });
    assert.equal(toErrorResponse({ code: 'P2002' }).status, 409);
    assert.equal(toErrorResponse({ code: 'P2025' }).status, 404);
    assert.equal(toErrorResponse({ type: 'entity.parse.failed' }).status, 400);
    assert.equal(toErrorResponse({ type: 'entity.too.large' }).status, 413);

    const scope = toErrorResponse(Object.assign(new Error('Request had insufficient authentication scopes.'), { code: 403 }));
    assert.equal(scope.status, 403);
    assert.equal(scope.body.code, 'reauth_required');
    const rateLimited = toErrorResponse(Object.assign(new Error('User rate limit exceeded'), { code: 403 }));
    assert.equal(rateLimited.status, 500, 'a rate-limit 403 must not tell the user to sign in again');

    const unknown = toErrorResponse(new Error('secret db password in message'));
    assert.deepEqual(unknown, { status: 500, body: { error: 'Internal Server Error' } });
});

test('id patterns accept real ids and reject path tricks', () => {
    for (const ok of ['18c3f9a1b2d4e5f6', 'demo_1', 'r-123_abc']) assert.ok(EMAIL_ID_RE.test(ok), ok);
    for (const bad of ['', 'a b', 'a/b', '../x', 'x'.repeat(129)]) assert.ok(!EMAIL_ID_RE.test(bad), bad);
    assert.ok(DRAFT_ID_RE.test('r-5'));
    assert.ok(!DRAFT_ID_RE.test('x'.repeat(65)));
    for (const ok of ['1', '0.2.1', '12']) assert.ok(PART_ID_RE.test(ok), ok);
    for (const bad of ['x', '1..2', '1.', '.1', '1/2', '']) assert.ok(!PART_ID_RE.test(bad), bad);
});

test('reserved category names are case- and space-insensitive', () => {
    for (const n of ['All', ' sent ', 'DRAFTS', 'inbox', 'Starred']) assert.ok(isReservedCategoryName(n), n);
    assert.ok(!isReservedCategoryName('Work'));
});

test('category validators', () => {
    assert.deepEqual(parseCategoryCreate({ name: ' Work ', description: ' stuff ' }), { name: 'Work', description: 'stuff' });
    assert.throws(() => parseCategoryCreate({ name: 'Sent', description: 'x' }), (e) => e.status === 400 && e.code === 'reserved_name');
    assert.throws(() => parseCategoryCreate({ name: '  ', description: 'x' }), (e) => e.status === 400);
    assert.throws(() => parseCategoryCreate({ name: 'x'.repeat(51), description: 'x' }), (e) => e.status === 400);
    assert.throws(() => parseCategoryCreate({ name: 'ok', description: 5 }), (e) => e.status === 400);
    assert.deepEqual(parseCategoryPatch({ description: 'new' }), { description: 'new' });
    assert.throws(() => parseCategoryPatch({}), (e) => e.status === 400);
    assert.deepEqual(toCategoryDto({ id: 3, category_name: 'A', category_description: 'B', user_id: 9 }), { id: 3, name: 'A', description: 'B' });
});

test('session tokens: issued ones verify, tampered or malformed ones do not', () => {
    let cookie;
    createSession({ cookie: (_name, value) => { cookie = value; } }, 42);
    assert.equal(verifySessionToken(cookie), 42);

    const [payloadPart, sig] = cookie.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 1, exp: Date.now() + 1e9 })).toString('base64url');
    assert.equal(verifySessionToken(`${forged}.${sig}`), null, 'payload swapped under an old signature');
    assert.equal(verifySessionToken(`${payloadPart}.${sig.slice(0, -2)}xx`), null);
    for (const junk of [undefined, null, '', 'a', 'a.b.c', 123]) assert.equal(verifySessionToken(junk), null);
});
