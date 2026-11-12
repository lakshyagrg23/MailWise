import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { buildRawMessage } from '../../utils/gmail/mimeBuilder.js';
import { extractBody } from '../../utils/gmail/extractBody.js';
import { executeWithRetry } from '../../utils/retryHelper.js';
import { asyncPoolValues } from '../../utils/asyncPool.js';
import { decodeHtmlEntities, stripHtml } from '../../utils/emailCleaner.js';
import { pageTokenFrom } from '../../utils/http/pagination.js';
import { badRequest, notFound } from '../../utils/http/httpErrors.js';

// Gmail errors (including 403 insufficient-scope -> reauth_required) are mapped centrally by
// toErrorResponse in utils/httpErrors.js, so these handlers just let them propagate.

const DRAFT_LIMIT = 20;

const toEditableText = (body) => {
    if (!body) return '';
    if (!/<[a-z][\s\S]*>/i.test(body)) return body;
    return stripHtml(body)
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const headerOf = (headers, name) =>
    (headers || []).find((h) => h.name.toLowerCase() === name)?.value || '';

/** GET /api/v1/drafts - list rows shaped like email_metadata for the client list. */
export const listDrafts = async (req, res) => {
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
            nextPageToken: null,
        });
    }

    const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
    const list = await gmail.users.drafts.list({
        userId: 'me',
        maxResults: DRAFT_LIMIT,
        pageToken: pageTokenFrom(req),
    });
    const drafts = list.data.drafts || [];

    const emails = await asyncPoolValues(10, drafts, async (d) => {
        const detail = await executeWithRetry(
            () => gmail.users.drafts.get({ userId: 'me', id: d.id, format: 'metadata' }),
            { maxRetries: 2, baseDelayMs: 500, factor: 2, context: `GmailDraft-${d.id}` }
        );
        const msg = detail.data.message || {};
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
};

/** GET /api/v1/drafts/:draftId - full draft, to repopulate the compose window. */
export const getDraft = async (req, res) => {
    const { draftId } = req.params;

    if (req.user.isDemo) {
        return res.json({
            draftId,
            to: 'client@example.com',
            subject: 'Follow-up on the proposal',
            body: 'Hi, just checking in on the proposal we discussed.',
        });
    }

    const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
    let data;
    try {
        ({ data } = await gmail.users.drafts.get({ userId: 'me', id: draftId, format: 'full' }));
    } catch (error) {
        if (error?.code === 404) throw notFound('Draft not found');
        throw error;
    }

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
};

/** Builds the MIME message from the request body, then creates a draft or replaces `draftId`. */
const writeDraft = async (req, res, draftId) => {
    if (req.user.isDemo) {
        return res.status(draftId ? 200 : 201).json({ draftId: draftId || 'demo_draft_new', saved: true });
    }

    const { to, subject, body, cc, bcc } = req.body || {};
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
        if (err.isValidation) throw badRequest(err.message);
        throw err;
    }

    const requestBody = { message: { raw } };
    let result;
    let created = !draftId;
    try {
        result = draftId
            ? await gmail.users.drafts.update({ userId: 'me', id: draftId, requestBody })
            : await gmail.users.drafts.create({ userId: 'me', requestBody });
    } catch (error) {
        // Updating a draft that was deleted elsewhere: recreate instead of failing
        if (draftId && error?.code === 404) {
            result = await gmail.users.drafts.create({ userId: 'me', requestBody });
            created = true;
        } else {
            throw error;
        }
    }

    return res.status(created ? 201 : 200).json({ draftId: result.data.id, saved: true });
};

/** POST /api/v1/drafts - create a draft. */
export const createDraft = (req, res) => writeDraft(req, res, undefined);

/** PUT /api/v1/drafts/:draftId - replace a draft's content (recreated if it no longer exists). */
export const updateDraft = (req, res) => writeDraft(req, res, req.params.draftId);

/** DELETE /api/v1/drafts/:draftId */
export const deleteDraft = async (req, res) => {
    if (req.user.isDemo) return res.json({ deleted: true });

    const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
    try {
        await gmail.users.drafts.delete({ userId: 'me', id: req.params.draftId });
    } catch (error) {
        if (error?.code !== 404) throw error; // already gone is fine (idempotent delete)
    }
    return res.json({ deleted: true });
};
