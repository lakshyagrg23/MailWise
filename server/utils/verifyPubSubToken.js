import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client();

/**
 * Express middleware: authenticates a Google Pub/Sub push request by verifying
 * the OIDC JWT in the Authorization header. Fails closed (401) on any problem,
 * including missing configuration. Runs before the body is trusted.
 */
export const verifyPubSubToken = async (req, res, next) => {
    const audience = process.env.PUBSUB_AUDIENCE;
    const expectedEmail = process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL;

    if (!audience || !expectedEmail) {
        console.error("Pub/Sub webhook auth not configured (PUBSUB_AUDIENCE / PUBSUB_SERVICE_ACCOUNT_EMAIL)");
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const header = req.headers.authorization || "";
        const match = /^Bearer\s+(\S+)$/i.exec(header);
        if (!match) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const ticket = await client.verifyIdToken({ idToken: match[1], audience });
        const payload = ticket.getPayload();

        if (!payload || payload.email_verified !== true || payload.email !== expectedEmail) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        req.pubsubClaims = { email: payload.email, sub: payload.sub };
        return next();
    } catch (error) {
        console.warn("Pub/Sub token verification failed:", error.message);
        return res.status(401).json({ error: "Unauthorized" });
    }
};

export default verifyPubSubToken;
