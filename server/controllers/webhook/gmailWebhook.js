import dotenv from "dotenv";

dotenv.config();

export const gmailWebhook = async (req, res) => {
    console.log("Gmail Webhook Received");
    try {
        const { message } = req.body || {};

        if (!message || !message.data) {
            console.log("No message data found in webhook payload");
            return res.status(400).send("Invalid webhook payload");
        }

        // Pub/Sub data is base64-encoded
        const decodedData = Buffer.from(message.data, 'base64').toString('utf-8');
        console.log("Webhook Decoded Data:", decodedData);

        // Acknowledge receipt immediately to avoid Pub/Sub retry loops
        return res.status(200).json({ message: "Webhook processed successfully" });
    } catch (error) {
        console.error("Error processing webhook:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const fetchMail = gmailWebhook;
