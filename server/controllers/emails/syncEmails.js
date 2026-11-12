import prisma from '../../lib/prisma.js';
import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { filterUnprocessedEmailIds, fetchRawEmailsConcurrently } from '../../services/gmailFetchService.js';
import { processAndClassifyEmails } from '../../services/batchClassificationService.js';

const INBOX_QUERY = '-in:trash -in:draft (-in:sent OR in:inbox)';
const WINDOW_SIZE = 20;

/**
 * POST /api/v1/emails/sync
 * Pulls the newest Gmail messages, classifies the unseen ones with Gemini, stores them, and
 * reconciles read/starred state for the window with Gmail. Has side effects (Gmail, Gemini,
 * database), hence POST. Read the result with GET /api/v1/emails.
 */
export const syncEmails = async (req, res) => {
    // Demo data is seeded at login; there is nothing to pull
    if (req.user.isDemo) return res.json({ newEmails: 0 });

    const userId = req.user.id;
    const { gmail } = await getAuthenticatedClient({ userId });

    // 1. Newest message IDs (excluding trash and drafts)
    const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: WINDOW_SIZE,
        q: INBOX_QUERY
    });
    const messageIds = (listResponse.data.messages || []).map(m => m.id);

    // 2. Reconcile read/starred state with Gmail for the messages in this window, so changes
    // made in Gmail itself show correctly here. New IDs are not stored yet: their state is
    // set from labelIds at ingestion below.
    try {
        const [unreadList, starredList] = await Promise.all([
            gmail.users.messages.list({ userId: 'me', maxResults: 100, q: `is:unread ${INBOX_QUERY}` }),
            gmail.users.messages.list({ userId: 'me', maxResults: 100, q: `is:starred ${INBOX_QUERY}` })
        ]);
        const unreadSet = new Set((unreadList.data.messages || []).map(m => m.id));
        const starredSet = new Set((starredList.data.messages || []).map(m => m.id));

        const flip = (field, set, stateWhenInSet) =>
            Promise.all([true, false].map(inSet => {
                const ids = messageIds.filter(id => set.has(id) === inSet);
                const value = inSet ? stateWhenInSet : !stateWhenInSet;
                return prisma.emailMetadata.updateMany({
                    where: { user_id: userId, email_id: { in: ids }, [field]: !value },
                    data: { [field]: value }
                });
            }));

        await flip('is_read', unreadSet, false); // in the unread list => is_read false
        await flip('is_starred', starredSet, true);
    } catch (syncErr) {
        console.warn("[syncEmails] Read/star sync skipped:", syncErr.message);
    }

    // 3. Delta filtering: only brand-new, unprocessed emails
    const newIds = await filterUnprocessedEmailIds(messageIds, userId);
    if (newIds.length === 0) return res.json({ newEmails: 0 });

    console.log(`[syncEmails] Processing ${newIds.length} new incoming emails for user ${userId}...`);

    // Pre-fetch user categories once (avoids N+1 queries)
    const categories = await prisma.categoryPreference.findMany({
        where: { user_id: userId },
        select: { category_name: true, category_description: true }
    });

    const rawEmails = await fetchRawEmailsConcurrently(newIds, gmail, 10);
    if (rawEmails.length === 0) return res.json({ newEmails: 0 });

    // Spam/Promos/Social labels bypass Gemini; the rest are classified in a batch
    const classifiedEmails = await processAndClassifyEmails(rawEmails, categories, 2);

    // Gmail's UNREAD / STARRED labels at ingestion time become our flags
    const unreadIds = new Set(rawEmails.filter(e => (e.labelIds || []).includes('UNREAD')).map(e => e.email_id));
    const starredIds = new Set(rawEmails.filter(e => (e.labelIds || []).includes('STARRED')).map(e => e.email_id));
    const records = classifiedEmails.map(record => ({
        ...record,
        is_read: !unreadIds.has(record.email_id),
        is_starred: starredIds.has(record.email_id),
        user_id: userId
    }));

    const { count } = records.length
        ? await prisma.emailMetadata.createMany({ data: records, skipDuplicates: true })
        : { count: 0 };

    return res.json({ newEmails: count });
};
