import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../../prisma.js';
import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { filterUnprocessedEmailIds, fetchRawEmailsConcurrently } from '../../services/gmailFetchService.js';
import { processAndClassifyEmails } from '../../services/batchClassificationService.js';
import { getSentEmails } from './getSentEmails.js';
import { getDraftEmails } from './drafts.js';

dotenv.config();

export const getEmailsByCategory = async (req, res) => {
    const { category } = req.params;

    // Sent mail is a live Gmail view, not a classified category
    if (category.toLowerCase() === 'sent') return getSentEmails(req, res);
    if (category.toLowerCase() === 'drafts') return getDraftEmails(req, res);

    // 1. Handle Demo Account
    if (req.user.isDemo) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.status(404).json({ error: "Demo user not found" });

        const whereClause = { user_id: user.id };
        if (category !== "All") {
            whereClause.category = { equals: category, mode: 'insensitive' };
        }

        const storedEmails = await prisma.emailMetadata.findMany({
            where: whereClause,
            orderBy: { received_date: 'desc' }
        });

        const serializedDemoEmails = storedEmails.map(email => ({
            ...email,
            update: email.update ? email.update.toString() : null
        }));

        return res.json({
            emails: serializedDemoEmails,
            name: user.name,
            pic: user.profile_pic_url,
            email: user.email
        });
    }

    try {
        const userId = req.user.id;

        // 2. Resolve Authenticated Client and User
        const { gmail, accessToken: activeToken, user: authUser } = await getAuthenticatedClient({ userId });

        let userInfo = null;

        try {
            const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${activeToken}` }
            });
            userInfo = userInfoResponse.data;
        } catch (infoErr) {
            console.warn("[getEmailsByCategory] UserInfo fetch warning:", infoErr.message);
        }

        // 3. List Latest Message IDs from Gmail (Excluding Trash and Drafts)
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            // Sent mail lives in its own view; keep mail you sent to yourself (it also has INBOX)
            q: '-in:trash -in:draft (-in:sent OR in:inbox)'
        });
        const messageIds = (listResponse.data.messages || []).map(m => m.id);

        // 3b. Reconcile read/starred state with Gmail for the messages in this window, so changes
        // made in Gmail itself show correctly here. New IDs are not stored yet: their state is
        // set from labelIds at ingestion below.
        try {
            const base = '-in:trash -in:draft (-in:sent OR in:inbox)';
            const [unreadList, starredList] = await Promise.all([
                gmail.users.messages.list({ userId: 'me', maxResults: 100, q: `is:unread ${base}` }),
                gmail.users.messages.list({ userId: 'me', maxResults: 100, q: `is:starred ${base}` })
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
            console.warn("[getEmailsByCategory] Read/star sync skipped:", syncErr.message);
        }

        // 4. Delta Filtering: Identify only brand-new, unprocessed emails
        const newIds = await filterUnprocessedEmailIds(messageIds, userId);

        // 5. Process New Emails via Fast-Path & Token-Aware Batches
        if (newIds.length > 0) {
            console.log(`[getEmailsByCategory] Processing ${newIds.length} new incoming emails for user ${userId}...`);

            // Pre-fetch user categories once (eliminates N+1 DB queries)
            const categories = await prisma.categoryPreference.findMany({
                where: { user_id: userId },
                select: { category_name: true, category_description: true }
            });

            // Fetch raw emails concurrently (10 at a time)
            const rawEmails = await fetchRawEmailsConcurrently(newIds, gmail, 10);

            if (rawEmails.length > 0) {
                // Route zero-cost labels (Spam/Promos/Social) and classify Primary/Updates with Gemini
                const classifiedEmails = await processAndClassifyEmails(rawEmails, categories, 2);

                // Bulk insert all classified emails into PostgreSQL
                // Gmail's UNREAD label at ingestion time becomes our is_read flag
                const unreadIds = new Set(
                    rawEmails.filter(e => (e.labelIds || []).includes('UNREAD')).map(e => e.email_id)
                );
                const starredIds = new Set(
                    rawEmails.filter(e => (e.labelIds || []).includes('STARRED')).map(e => e.email_id)
                );
                const recordsToInsert = classifiedEmails.map(record => ({
                    ...record,
                    is_read: !unreadIds.has(record.email_id),
                    is_starred: starredIds.has(record.email_id),
                    user_id: userId
                }));

                if (recordsToInsert.length > 0) {
                    await prisma.emailMetadata.createMany({
                        data: recordsToInsert,
                        skipDuplicates: true
                    });
                    console.log(`[getEmailsByCategory] Bulk inserted ${recordsToInsert.length} emails into database.`);
                }
            }
        }

        // 6. Query Stored Emails for the Requested Category from PostgreSQL
        const whereClause = { user_id: userId };
        // Hide sent mail that was ingested before Sent got its own view
        const ownAddress = userInfo?.email || authUser?.email;
        if (ownAddress) {
            whereClause.NOT = { sender: { contains: ownAddress, mode: 'insensitive' } };
        }
        if (category !== "All") {
            whereClause.category = { equals: category, mode: 'insensitive' };
        }

        const storedEmails = await prisma.emailMetadata.findMany({
            where: whereClause,
            orderBy: { received_date: 'desc' }
        });

        const serializedEmails = storedEmails.map(email => ({
            ...email,
            update: email.update ? email.update.toString() : null
        }));

        return res.json({
            emails: serializedEmails,
            name: userInfo?.name || authUser?.name,
            pic: userInfo?.picture || authUser?.profile_pic_url,
            email: userInfo?.email || authUser?.email
        });

    } catch (error) {
        console.error("Error fetching/classifying emails:", error);
        return res.status(500).json({ error: "Failed to fetch/classify emails" });
    }
};

export const fetch1 = getEmailsByCategory;
