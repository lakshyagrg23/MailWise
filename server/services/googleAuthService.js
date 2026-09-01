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
 * Retrieves an authenticated OAuth2Client and Gmail instance for a given user or access token.
 * Automatically refreshes expired access tokens using the stored refresh_token in PostgreSQL.
 *
 * @param {Object} params
 * @param {string} [params.accessToken]
 * @param {number|string} [params.userId]
 * @param {string} [params.googleId]
 * @returns {Promise<{ authClient: any, gmail: any, user: any, accessToken: string, isDemo: boolean }>}
 */
export const getAuthenticatedClient = async ({ accessToken, userId, googleId } = {}) => {
    // Sanitize string "null" or "undefined"
    let cleanAccessToken = accessToken;
    if (cleanAccessToken === 'undefined' || cleanAccessToken === 'null') {
        cleanAccessToken = null;
    }

    // 1. Handle demo mode
    if (cleanAccessToken === 'demo') {
        return { isDemo: true, accessToken: 'demo' };
    }

    const oauth2Client = createOAuth2Client();

    // 2. Find user in database to retrieve stored tokens
    let user = null;
    if (userId && !isNaN(parseInt(userId))) {
        user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
    } else if (googleId) {
        user = await prisma.user.findUnique({ where: { google_id: googleId } });
    } else if (cleanAccessToken) {
        user = await prisma.user.findFirst({ where: { access_token: cleanAccessToken } });
    }

    // 3. Determine active token and refresh token (prefer latest DB token if user resolved)
    let currentToken = user?.access_token || cleanAccessToken;
    const refreshToken = user?.refresh_token;
    const tokenExpiry = user?.token_expiry ? new Date(user.token_expiry).getTime() : 0;
    // Check if token has expired or is expiring within the next 5 minutes
    const isExpired = tokenExpiry > 0 && Date.now() >= (tokenExpiry - 5 * 60 * 1000);

    // 4. Auto-refresh if expired and refresh_token is present
    if (refreshToken && (isExpired || !currentToken)) {
        try {
            console.log(`[AuthService] Refreshing access token for user ${user?.email || user?.id}...`);
            oauth2Client.setCredentials({ refresh_token: refreshToken });
            const refreshResponse = await oauth2Client.refreshAccessToken();
            const credentials = refreshResponse.credentials;

            currentToken = credentials.access_token;
            const newExpiry = credentials.expiry_date
                ? new Date(credentials.expiry_date)
                : new Date(Date.now() + 3600 * 1000);

            if (user?.id) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        access_token: currentToken,
                        token_expiry: newExpiry,
                        ...(credentials.refresh_token ? { refresh_token: credentials.refresh_token } : {})
                    }
                });
            }
            console.log(`[AuthService] Token refreshed successfully for user ${user?.id}`);
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
        accessToken: currentToken,
        isDemo: false
    };
};
