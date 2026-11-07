import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { buildRawMessage } from '../../utils/mimeBuilder.js';
import { extractBody } from '../helpFunctions/extractBody.js';
import { executeWithRetry } from '../../utils/retryHelper.js';
import { asyncPoolValues } from '../../utils/asyncPool.js';
import { decodeHtmlEntities, stripHtml } from '../../utils/emailCleaner.js';

const DRAFT_LIMIT = 20;

const toEditableText = (body) => {
    if (!body) return '';
    if (!/<[a-z][\s\S]*>/i.test(body)) return body;
    return stripHtml(body)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};
const DRAFT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// Opaque Gmail page token from ?pageToken=; ignore anything that isn't a plain token string
export const pageTokenFrom = (req) => {
    const t = req.query?.pageToken;
    return typeof t === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(t) ? t : undefined;
};

const headerOf =(headers, name) =>
    (headers || []).find((h) => h.name.toLowerCase() === name)?.value || '';

// Gmail reports missing-scope as 403 insufficientPermissions: tell the client to re-login
const isScopeError = (err) =>
    err?.code === 403 || err?.status === 403 || /insufficient/i.test(err?.message || '');

const fail = (res, err, label) => {
    console.error(`${label}:`, err);
    if (isScopeError(err)) {
        return res.status(403).json({
            error: 'Drafts need extra Gmail permission. Please sign out and sign in again.',
            code: 'reauth_required',
        });
    }
    return res.status(500).json({ error: label });
};

/** GET /fetch-emails/Drafts - list rows shaped like email_metadata for the client list. */
export const getDraftEmails = async (req, res) => {
    if (req.user.isDemo) {
        return res.json({
            emails: [
                {
                    email_id: 'demo_draft_1',
                    draft_id: 'demo_draft_1',
                    subject: 'Follow-up on the proposal',
                    sender: 'client@example.com',
                    category: 'Drafts',
                    is_draft: true,
                    emailsummary: 'Hi, just checking in on the proposal we discussed...',
                    received_date: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
                },
            ],
        });
    }

    try {
        const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
        const list = await gmail.users.drafts.list({
            userId: 'me',
            maxResults: DRAFT_LIMIT,
            pageToken: pageTokenFrom(req),
        });
        const drafts = list.data.drafts || [];

        const emails = await asyncPoolValues(10, drafts, async (d) => {
            const res2 = await executeWithRetry(
                () =>
                    gmail.users.drafts.get({
                        userId: 'me',
                        id: d.id,
                        format: 'metadata',
                    }),
                { maxRetries: 2, baseDelayMs: 500, factor: 2, context: `GmailDraft-${d.id}` }
            );
            const msg = res2.data.message || {};
            const headers = msg.payload?.headers || [];
            return {
                email_id: d.id,
                draft_id: d.id,
                subject: headerOf(headers, 'subject') || '(No Subject)',
                sender: headerOf(headers, 'to') || '(No recipient)',
                category: 'Drafts',
                is_draft: true,
                emailsummary: decodeHtmlEntities(msg.snippet || ''),
                received_date: new Date(parseInt(msg.internalDate || Date.now(), 10)).toISOString(),
            };
        });

        emails.sort((a, b) => new Date(b.received_date) - new Date(a.received_date));
        return res.json({ emails, nextPageToken: list.data.nextPageToken || null });
    } catch (error) {
        return fail(res, error, 'Failed to fetch drafts');
    }
};

/** GET /email/drafts/:draftId - full draft, to repopulate the compose window. */
export const getDraft = async (req, res) => {
    const { draftId } = req.params;
    if (!DRAFT_ID_RE.test(draftId)) return res.status(400).json({ error: 'Invalid draft ID' });

    if (req.user.isDemo) {
        return res.json({
            draftId,
            to: 'client@example.com',
            subject: 'Follow-up on the proposal',
            body: 'Hi, just checking in on the proposal we discussed.',
        });
    }

    try {
        const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
        const { data } = await gmail.users.drafts.get({ userId: 'me', id: draftId, format: 'full' });
        const payload = data.message?.payload;
        return res.json({
            draftId,
            to: headerOf(payload?.headers, 'to'),
            cc: headerOf(payload?.headers, 'cc'),
            bcc: headerOf(payload?.headers, 'bcc'),
            subject: headerOf(payload?.headers, 'subject'),
            // The editor is a plain textarea: prefer the text/plain part; for HTML-only drafts
            // (e.g. written in Gmail's editor) flatten the HTML instead of showing raw markup
            body: toEditableText(extractBody(payload)),
        });
    } catch (error) {
        if (error?.code === 404) return res.status(404).json({ error: 'Draft not found' });
        return fail(res, error, 'Failed to load draft');
    }
};

/** POST /email/drafts - create, or update when `draftId` is given. */
export const saveDraft = async (req, res) => {
    if (req.user.isDemo) {
        return res.json({ draftId: req.body?.draftId || 'demo_draft_new', saved: true });
    }

    const { draftId, to, subject, body, cc, bcc } = req.body || {};
    if (draftId !== undefined && !DRAFT_ID_RE.test(String(draftId))) {
        return res.status(400).json({ error: 'Invalid draft ID' });
    }

    try {
        const { gmail, user } = await getAuthenticatedClient({ userId: req.user.id });

        let raw;
        try {
            raw = buildRawMessage({
                from: user?.email || 'me',
                to,
                subject,
                body,
                reqBody: { cc, bcc },
                draft: true,
            });
        } catch (err) {
            if (err.isValidation) return res.status(400).json({ error: err.message });
            throw err;
        }

        const requestBody = { message: { raw } };
        const result = draftId
            ? await gmail.users.drafts.update({ userId: 'me', id: draftId, requestBody })
            : await gmail.users.drafts.create({ userId: 'me', requestBody });

        return res.json({ draftId: result.data.id, saved: true });
    } catch (error) {
        // Updating a draft that was deleted elsewhere: recreate instead of failing
        if (draftId && error?.code === 404) {
            req.body.draftId = undefined;
            return saveDraft(req, res);
        }
        return fail(res, error, 'Failed to save draft');
    }
};

/** DELETE /email/drafts/:draftId */
export const deleteDraft = async (req, res) => {
    const { draftId } = req.params;
    if (!DRAFT_ID_RE.test(draftId)) return res.status(400).json({ error: 'Invalid draft ID' });
    if (req.user.isDemo) return res.json({ deleted: true });

    try {
        const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
        await gmail.users.drafts.delete({ userId: 'me', id: draftId });
        return res.json({ deleted: true });
    } catch (error) {
        if (error?.code === 404) return res.json({ deleted: true });
        return fail(res, error, 'Failed to delete draft');
    }
};
