import prisma from '../lib/prisma.js';
import { getAuthenticatedClient } from './googleAuthService.js';
import { filterUnprocessedEmailIds, fetchRawEmailsConcurrently } from './gmailFetchService.js';
import { processAndClassifyEmails } from './batchClassificationService.js';

const INBOX_QUERY = '-in:trash -in:draft (-in:sent OR in:inbox)';
const WINDOW_SIZE = 20;
const FLAG_LOOKUP_LIMIT = 100;

/**
 * Brings stored read/starred flags in line with Gmail for the messages in the current window, so
 * changes made in Gmail itself show correctly here. New IDs are not stored yet: their state is set
 * from labelIds at ingestion. Best effort: a failure here must not block ingestion.
 */
const reconcileFlags = async (gmail, userId, messageIds) => {
    try {
        const [unreadList, starredList] = await Promise.all([
            gmail.users.messages.list({ userId: 'me', maxResults: FLAG_LOOKUP_LIMIT, q: `is:unread ${INBOX_QUERY}` }),
            gmail.users.messages.list({ userId: 'me', maxResults: FLAG_LOOKUP_LIMIT, q: `is:starred ${INBOX_QUERY}` })
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
    } catch (err) {
        console.warn('[syncService] Read/star reconcile skipped:', err.message);
    }
};

/** Fetches, classifies and stores messages not seen before. Returns how many rows were created. */
const ingestNewEmails = async (gmail, userId, messageIds) => {
    const newIds = await filterUnprocessedEmailIds(messageIds, userId);
    if (newIds.length === 0) return 0;

    console.log(`[syncService] Processing ${newIds.length} new incoming emails for user ${userId}...`);

    // Pre-fetch user categories once (avoids N+1 queries)
    const categories = await prisma.categoryPreference.findMany({
        where: { user_id: userId },
        select: { category_name: true, category_description: true }
    });

    const rawEmails = await fetchRawEmailsConcurrently(newIds, gmail, 10);
    if (rawEmails.length === 0) return 0;

    // Spam/Promos/Social labels bypass Gemini; the rest are classified in a batch
    const classified = await processAndClassifyEmails(rawEmails, categories, 2);

    // Gmail's UNREAD / STARRED labels at ingestion time become our flags
    const withLabel = (label) =>
        new Set(rawEmails.filter(e => (e.labelIds || []).includes(label)).map(e => e.email_id));
    const unreadIds = withLabel('UNREAD');
    const starredIds = withLabel('STARRED');

    const records = classified.map(record => ({
        ...record,
        is_read: !unreadIds.has(record.email_id),
        is_starred: starredIds.has(record.email_id),
        user_id: userId
    }));
    if (records.length === 0) return 0;

    const { count } = await prisma.emailMetadata.createMany({ data: records, skipDuplicates: true });
    return count;
};

/**
 * Pulls the newest Gmail messages for a user, reconciles read/starred state, and classifies and
 * stores unseen mail. Resolves to { newEmails }.
 */
export const syncUserMailbox = async (userId) => {
    const { gmail } = await getAuthenticatedClient({ userId });

    const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: WINDOW_SIZE,
        q: INBOX_QUERY
    });
    const messageIds = (listResponse.data.messages || []).map(m => m.id);

    await reconcileFlags(gmail, userId, messageIds);
    const newEmails = await ingestNewEmails(gmail, userId, messageIds);

    return { newEmails };
};
