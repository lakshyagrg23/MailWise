import { extractBody } from "../../utils/gmail/extractBody.js";
import { collectAttachments } from "../../utils/gmail/attachments.js";
import { getAuthenticatedClient } from "../../services/googleAuthService.js";

/**
 * GET /api/v1/emails/:emailId
 * Body is read live from Gmail. Attachments are returned as metadata only
 * ({ partId, filename, mimeType, size }); the bytes come from
 * GET /api/v1/emails/:emailId/attachments/:partId.
 */
export const getEmailById = async (req, res) => {
    const emailId = req.params.emailId;

    if (!emailId) {
        return res.status(400).json({ error: "Missing email ID" });
    }

    if (req.user.isDemo) {
        return res.json({
            email: {
                _id: emailId,
                email_id: emailId,
                userId: emailId,
                subject: "Demo Email Subject",
                sender: "demo@mailwise.app",
                body: "<div><h2>Welcome to MailWise!</h2><br/><p>This is a simulated email body for the demo account.</p><p>You can interact with this email just like a real one. Try reading the hover summary, replying, or exploring the analytics features!</p></div>",
                received_at: new Date().toISOString(),
                attachments: []
            }
        });
    }

    try {
        const { gmail } = await getAuthenticatedClient({ userId: req.user.id });
        const msg = await gmail.users.messages.get({ userId: "me", id: emailId });

        if (!msg.data) {
            return res.status(404).json({ error: "Email not found" });
        }

        const headers = msg.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === "Subject")?.value || "No Subject";
        const sender = headers.find((h) => h.name === "From")?.value || "Unknown Sender";
        const body = extractBody(msg.data.payload, { preferHtml: true });
        const receivedAt = new Date(parseInt(msg.data.internalDate)).toISOString();

        return res.json({
            email: {
                _id: emailId,
                email_id: emailId,
                userId: emailId,
                subject,
                sender,
                body,
                received_at: receivedAt,
                attachments: collectAttachments(msg.data.payload),
            },
        });
    } catch (error) {
        console.error(`Error fetching email ${emailId}:`, error);
        return res.status(500).json({ error: "Failed to fetch email" });
    }
};
