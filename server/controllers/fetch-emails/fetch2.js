import { google } from 'googleapis';
import { extractBody } from '../helpFunctions/extractBody.js';

export const fetch2 = async (req, res) => {
    const { email_id } = req.params;
    const accessToken = req.headers.authorization?.split(' ')[1] || req.query.access_token;

    console.log("Received email_id:", email_id);
    console.log("Received accessToken:", accessToken ? "Exists" : "Not Provided");

    if (!email_id || !accessToken) {
        return res.status(400).json({ error: "Missing email_id or access_token" });
    }

    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
        // console.log(`Fetching email with ID: ${email_id}`);
        const msg = await gmail.users.messages.get({ userId: 'me', id: email_id });
        console.log("Raw Email Data:", JSON.stringify(msg.data, null, 2)); // Debugging log
        // console.log(msg)
        const headers = msg.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const sender = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const body = extractBody(msg.data.payload);
        const receivedAt = new Date(parseInt(msg.data.internalDate)).toISOString();

        res.json({
            email: {
                _id: email_id,
                email_id,
                subject,
                sender,
                body,
                received_at: receivedAt
            }
        });
    } catch (error) {
        console.error(`❌ Error fetching email ${email_id}:`, error.response?.data || error);
        res.status(500).json({ error: "Failed to fetch email" });
    }
};
