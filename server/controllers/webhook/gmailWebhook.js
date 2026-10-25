import dotenv from "dotenv";
import prisma from "../../prisma.js";

dotenv.config();

const isValidHistoryId = (value) =>
    (typeof value === "string" && /^\d{1,20}$/.test(value)) ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);

// Authentication is enforced by verifyPubSubToken in the route.
export const gmailWebhook = async (req, res) => {
    try {
        const { message } = req.body || {};

        if (!message || typeof message.data !== "string") {
            return res.status(400).send("Invalid webhook payload");
        }

        // Pub/Sub data is base64-encoded JSON
        let notification;
        try {
            notification = JSON.parse(Buffer.from(message.data, "base64").toString("utf-8"));
        } catch {
            return res.status(400).send("Invalid webhook payload");
        }

        const { emailAddress, historyId } = notification || {};
        if (typeof emailAddress !== "string" || !emailAddress || emailAddress.length > 320 || !isValidHistoryId(historyId)) {
            return res.status(400).send("Invalid webhook payload");
        }

        const user = await prisma.user.findUnique({ where: { email: emailAddress } });
        if (!user) {
            // Unknown address: ack so Pub/Sub does not retry
            console.log("Gmail webhook: notification for unknown user ignored");
            return res.status(200).end();
        }

        const incoming = BigInt(historyId);
        const stored = user.last_history_id;
        if (stored !== undefined && stored !== null && /^\d+$/.test(String(stored)) && incoming <= BigInt(String(stored))) {
            console.log(`Gmail webhook: stale historyId ${incoming} ignored for user ${user.id}`);
            return res.status(200).end();
        }

        // TODO: history processing (and persisting last_history_id) is future work.
        console.log(`Gmail webhook: accepted historyId ${incoming} for user ${user.id}`);
        return res.status(200).end();
    } catch (error) {
        console.error("Error processing webhook:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const fetchMail = gmailWebhook;
