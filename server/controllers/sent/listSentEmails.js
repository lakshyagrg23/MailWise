import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { executeWithRetry } from '../../utils/retryHelper.js';
import { asyncPoolValues } from '../../utils/asyncPool.js';
import { decodeHtmlEntities } from '../../utils/emailCleaner.js';
import { pageTokenFrom } from '../../utils/http/pagination.js';

const SENT_LIMIT = 20;

/**
 * Sent mail is not stored or classified: it is read live from Gmail (like bodies),
 * so it never mixes into the categorized inbox. Rows mimic the email_metadata shape
 * so the client list can render them; `sender` holds the recipient(s) and
 * `is_sent` tells the UI to label it "To:".
 */
export const listSentEmails = async (req, res) => {
    if (req.user.isDemo) {
        return res.json({
            emails: [
                {
                    email_id: 'demo_sent_1',
                    subject: 'Re: Your Interview Schedule',
                    sender: 'careers@techcorp.com',
                    category: 'Sent',
                    is_sent: true,
                    emailsummary: 'Thanks, Tuesday at 10 AM works for me.',
                    received_date: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
                },
            ],
            nextPageToken: null,
        });
    }

    const { gmail } = await getAuthenticatedClient({ userId: req.user.id });

    const list = await gmail.users.messages.list({
        userId: 'me',
        maxResults: SENT_LIMIT,
        q: 'in:sent -in:draft -in:trash',
        pageToken: pageTokenFrom(req),
    });
    const ids = (list.data.messages || []).map((m) => m.id);

    const emails = await asyncPoolValues(10, ids, async (id) => {
        const msg = await executeWithRetry(
            () =>
                gmail.users.messages.get({
                    userId: 'me',
                    id,
                    format: 'metadata',
                    metadataHeaders: ['To', 'Subject'],
                }),
            { maxRetries: 2, baseDelayMs: 500, factor: 2, context: `GmailSent-${id}` }
        );
        const headers = msg.data.payload?.headers || [];
        const header = (name) =>
            headers.find((h) => h.name.toLowerCase() === name)?.value || '';

        return {
            email_id: id,
            subject: header('subject') || 'No Subject',
            sender: header('to') || 'Unknown Recipient',
            category: 'Sent',
            is_sent: true,
            emailsummary: decodeHtmlEntities(msg.data.snippet || ''),
            received_date: new Date(parseInt(msg.data.internalDate, 10)).toISOString(),
        };
    });

    emails.sort((a, b) => new Date(b.received_date) - new Date(a.received_date));
    return res.json({ emails, nextPageToken: list.data.nextPageToken || null });
};
