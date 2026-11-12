import axios from 'axios';
import prisma from '../../lib/prisma.js';
import { createSession, consumeOAuthState } from '../../utils/session.js';
import { createOAuth2Client } from '../../services/googleAuthService.js';
import { DEFAULT_CATEGORIES } from '../../utils/categories.js';
import { env } from '../../config/env.js';

export const callback = async (req, res) => {
    // One client per request: setCredentials mutates it, so it must never be shared
    const oauth2Client = createOAuth2Client();
    try {
        if (!consumeOAuthState(req, res)) {
            return res.status(400).send("Invalid OAuth state");
        }

        const { code } = req.query;
        if (typeof code !== 'string' || !code) {
            return res.status(400).send("Missing authorization code");
        }

        const { tokens } = await oauth2Client.getToken(code);
        console.log("Received OAuth tokens:", {
            hasAccessToken: Boolean(tokens.access_token),
            hasRefreshToken: Boolean(tokens.refresh_token),
            expiryDate: tokens.expiry_date
        });

        oauth2Client.setCredentials(tokens);
        const accessToken = tokens.access_token;
        const tokenExpiry = tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

        // Fetch user details using the access token
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const userEmail = userInfoResponse.data.email;
        const userName = userInfoResponse.data.name;
        const userpic = userInfoResponse.data.picture;

        // Check if the user exists in the database
        const userCheckResult = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { id: true, update: true }
        });
        
        let userId, update;
        if (!userCheckResult) {
            // User doesn't exist, insert them with credentials into the database
            const userResult = await prisma.user.create({
                data: {
                    google_id: userInfoResponse.data.id,
                    name: userName,
                    email: userEmail,
                    profile_pic_url: userpic,
                    access_token: accessToken,
                    refresh_token: tokens.refresh_token || null,
                    token_expiry: tokenExpiry,
                    update: 1
                },
                select: { id: true, update: true }
            });
            userId = userResult.id;
            update = userResult.update;
            console.log("New user authenticated and stored with ID:", userId);

            // Insert default categories for the new user
            await insertDefaultCategories(userId);
        } else {
            // User already exists, update their latest tokens and profile info
            const updatePayload = {
                name: userName,
                profile_pic_url: userpic,
                access_token: accessToken,
                token_expiry: tokenExpiry,
            };
            if (tokens.refresh_token) {
                updatePayload.refresh_token = tokens.refresh_token;
            }

            const updatedUser = await prisma.user.update({
                where: { email: userEmail },
                data: updatePayload,
                select: { id: true, update: true }
            });

            userId = updatedUser.id;
            update = updatedUser.update;
            console.log("Existing user tokens updated for ID:", userId);
        }

        // Start a server-side session; no credentials or identifiers go in the URL
        createSession(res, userId);
        return res.redirect(`${env.frontendUrl}/emails/inbox`);
    } catch (error) {
        console.error("Error during OAuth callback:", error);
        return res.status(500).send("Authentication failed");
    }
};

async function insertDefaultCategories(userId) {
    try {
        await prisma.categoryPreference.createMany({
            data: DEFAULT_CATEGORIES.map(c => ({
                user_id: userId,
                category_name: c.name,
                category_description: c.description
            })),
            skipDuplicates: true
        });
        console.log(`Default categories inserted for user ${userId}`);
    } catch (error) {
        console.error("Error inserting default categories:", error);
    }
}
