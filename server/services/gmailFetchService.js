import prisma from '../prisma.js';
import { extractBody } from '../controllers/helpFunctions/extractBody.js';
import { asyncPoolValues } from '../utils/asyncPool.js';

// Cap individual raw body characters to prevent a single giant email from exhausting prompt token budgets
const MAX_BODY_CHARS = 4000;

/**
 * Searches payload parts recursively to identify any attachment filename.
 *
 * @param {Object} payload - Gmail message payload
 * @returns {string} Filename of attachment if found, else empty string
 */
export function findAttachmentName(payload) {
    if (!payload) return "";
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.filename && part.body?.attachmentId) {
                return part.filename;
            }
            if (part.parts) {
                const nested = findAttachmentName(part);
                if (nested) return nested;
            }
        }
    }
    return payload.filename && payload.body?.attachmentId ? payload.filename : "";
}

/**
 * Compares an array of Gmail message IDs against PostgreSQL and returns
 * only the IDs that have not yet been fetched and stored for this user.
 *
 * @param {string[]} messageIds - List of Gmail message IDs
 * @param {number} userId - Database ID of the user
 * @returns {Promise<string[]>} Array of unprocessed message IDs
 */
export async function filterUnprocessedEmailIds(messageIds, userId) {
    if (!messageIds || messageIds.length === 0 || !userId) {
        return [];
    }

    try {
        const existingEmails = await prisma.emailMetadata.findMany({
            where: {
                user_id: parseInt(userId),
                email_id: { in: messageIds }
            },
            select: { email_id: true }
        });

        const existingSet = new Set(existingEmails.map(e => e.email_id));
        const newIds = messageIds.filter(id => !existingSet.has(id));

        console.log(`[gmailFetchService] Total: ${messageIds.length} | Already stored: ${existingEmails.length} | To process: ${newIds.length}`);
        return newIds;
    } catch (error) {
        console.error("[gmailFetchService] Error filtering existing email IDs:", error.message);
        // If DB check fails, return all IDs to ensure no mail is silently dropped
        return messageIds;
    }
}

/**
 * Concurrently fetches message payloads from the Gmail API with sliding-window concurrency.
 *
 * @param {string[]} messageIds - List of Gmail message IDs to fetch
 * @param {any} gmailClient - Authenticated Gmail API client
 * @param {number} [concurrency=10] - Simultaneous network requests allowed
 * @returns {Promise<Array<{ email_id: string, subject: string, sender: string, body: string, attachName: string, receivedAt: string }>>}
 */
export async function fetchRawEmailsConcurrently(messageIds, gmailClient, concurrency = 10) {
    if (!messageIds || messageIds.length === 0 || !gmailClient) {
        return [];
    }

    console.log(`[gmailFetchService] Fetching ${messageIds.length} emails with concurrency limit ${concurrency}...`);

    const emails = await asyncPoolValues(concurrency, messageIds, async (messageId) => {
        try {
            const msg = await gmailClient.users.messages.get({
                userId: 'me',
                id: messageId,
                format: 'full'
            });

            if (!msg?.data?.payload) {
                return null;
            }

            const headers = msg.data.payload.headers || [];
            const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
            const sender = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
            
            let rawBody = extractBody(msg.data.payload) || '';
            if (rawBody.length > MAX_BODY_CHARS) {
                rawBody = rawBody.slice(0, MAX_BODY_CHARS) + '\n... [truncated for classification]';
            }

            const attachName = findAttachmentName(msg.data.payload);
            const receivedAt = msg.data.internalDate
                ? new Date(parseInt(msg.data.internalDate)).toISOString()
                : new Date().toISOString();

            return {
                email_id: messageId,
                subject,
                sender,
                body: rawBody,
                attachName,
                receivedAt
            };
        } catch (msgErr) {
            console.warn(`[gmailFetchService] Failed to fetch message ${messageId}:`, msgErr.message);
            return null;
        }
    });

    console.log(`[gmailFetchService] Successfully fetched ${emails.length} of ${messageIds.length} emails.`);
    return emails;
}
