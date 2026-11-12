import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { notFound, HttpError } from '../../utils/httpErrors.js';
import {
    MAX_ATTACHMENT_BYTES,
    findAttachmentPart,
    safeContentType,
    attachmentDisposition,
} from '../../utils/attachments.js';

/**
 * GET /api/v1/emails/:emailId/attachments/:partId
 * Streams one attachment as a download. The email detail response lists attachments as metadata
 * only; the bytes are fetched here, on demand, from the user's own mailbox.
 */
export const getAttachment = async (req, res) => {
    const { emailId, partId } = req.params;

    // Demo mail is seeded locally and has no attachments
    if (req.user.isDemo) throw notFound('Attachment not found');

    const { gmail } = await getAuthenticatedClient({ userId: req.user.id });

    let message;
    try {
        message = await gmail.users.messages.get({ userId: 'me', id: emailId, format: 'full' });
    } catch (err) {
        if (err?.code === 404) throw notFound('Email not found');
        throw err;
    }

    const part = findAttachmentPart(message.data?.payload, partId);
    if (!part) throw notFound('Attachment not found');

    if ((part.body.size ?? 0) > MAX_ATTACHMENT_BYTES) {
        throw new HttpError(413, 'Attachment is too large to download');
    }

    // Large attachments are referenced by id; small ones arrive inline in the part body
    let encoded = part.body.data;
    if (part.body.attachmentId) {
        const res = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: emailId,
            id: part.body.attachmentId,
        });
        encoded = res.data?.data;
    }
    if (!encoded) throw notFound('Attachment not found');

    const bytes = Buffer.from(encoded, 'base64url');

    res.set({
        'Content-Type': safeContentType(part.mimeType),
        'Content-Disposition': attachmentDisposition(part.filename),
        'Content-Length': String(bytes.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
    });
    return res.end(bytes);
};
