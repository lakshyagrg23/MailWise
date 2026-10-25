import { google } from 'googleapis';
import prisma from '../prisma.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Creates a new OAuth2 client using environment credentials.
 */
export const createOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

/**
 * Retrieves an authenticated OAuth2Client and Gmail instance for a user.
 * The userId MUST come from the authenticated session (req.user.id).
 * Automatically refreshes expired access tokens using the stored refresh_token in PostgreSQL.
 *
 * @param {Object} params
 * @param {number} params.userId
 * @returns {Promise<{ authClient: any, gmail: any, user: any, accessToken: string }>}
 */
export const getAuthenticatedClient = async ({ userId } = {}) => {
    if (!Number.isInteger(userId)) {
        throw new Error("getAuthenticatedClient requires a numeric userId");
    }

    const oauth2Client = createOAuth2Client();

    // 1. Load the user's stored tokens
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new Error("User not found");
    }

    // 2. Determine active token and refresh token
    let currentToken = user.access_token;
    const refreshToken = user.refresh_token;
    const tokenExpiry = user.token_expiry ? new Date(user.token_expiry).getTime() : 0;
    // Check if token has expired or is expiring within the next 5 minutes
    const isExpired = tokenExpiry > 0 && Date.now() >= (tokenExpiry - 5 * 60 * 1000);

    // 3. Auto-refresh if expired and refresh_token is present
    if (refreshToken && (isExpired || !currentToken)) {
        try {
            console.log(`[AuthService] Refreshing access token for user ${user.id}...`);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const refreshResponse = await oauth2Client.refreshAccessToken();
            const credentials = refreshResponse.credentials;

            currentToken = credentials.access_token;
            const newExpiry = credentials.expiry_date
                ? new Date(credentials.expiry_date)
                : new Date(Date.now() + 3600 * 1000);

            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    access_token: currentToken,
                    token_expiry: newExpiry,
                    ...(credentials.refresh_token ? { refresh_token: credentials.refresh_token } : {})
                }
            });
            console.log(`[AuthService] Token refreshed successfully for user ${user.id}`);
        } catch (refreshErr) {
            console.error("[AuthService] Failed to auto-refresh access token:", refreshErr.message);
        }
    }

    if (!currentToken) {
        throw new Error("Missing access token and no valid refresh token found");
    }

    oauth2Client.setCredentials({
        access_token: currentToken,
        refresh_token: refreshToken || undefined,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    return {
        authClient: oauth2Client,
        gmail,
        user,
        accessToken: currentToken
    };
};
