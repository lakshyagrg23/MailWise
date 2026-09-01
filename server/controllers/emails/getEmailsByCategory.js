import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../../prisma.js';
import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { filterUnprocessedEmailIds, fetchRawEmailsConcurrently } from '../../services/gmailFetchService.js';
import { processAndClassifyEmails } from '../../services/batchClassificationService.js';

dotenv.config();

export const getEmailsByCategory = async (req, res) => {
    const { category } = req.params;
    const accessToken = req.query.access_token;

    if (!accessToken) {
        return res.status(401).json({ error: "Missing access token" });
    }

    // 1. Handle Demo Account
    if (accessToken === "demo") {
        const user = await prisma.user.findUnique({ where: { google_id: 'demo_google_id' } });
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
        const queryUserId = req.query.user_id;

        // 2. Resolve Authenticated Client and User
        const { gmail, accessToken: activeToken, user: authUser } = await getAuthenticatedClient({
            accessToken,
            userId: queryUserId
        });

        let userId = authUser?.id;
        let userInfo = null;

        try {
            const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${activeToken}` }
            });
            userInfo = userInfoResponse.data;

            if (!userId) {
                const user = await prisma.user.findUnique({
                    where: { google_id: userInfo.id },
                    select: { id: true }
                });
                userId = user?.id;
            }
        } catch (infoErr) {
            console.warn("[getEmailsByCategory] UserInfo fetch warning:", infoErr.message);
        }

        if (!userId) {
            return res.status(404).json({ error: "User not found in database" });
        }

        // 3. List Latest Message IDs from Gmail (Excluding Trash and Drafts)
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            q: '-in:trash -in:draft'
        });
        const messageIds = (listResponse.data.messages || []).map(m => m.id);

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
                const recordsToInsert = classifiedEmails.map(record => ({
                    ...record,
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
            email: userInfo?.email || authUser?.email,
            activeToken: activeToken
        });

    } catch (error) {
        console.error("Error fetching/classifying emails:", error);
        return res.status(500).json({ error: "Failed to fetch/classify emails", details: error.message });
    }
};

export const fetch1 = getEmailsByCategory;
