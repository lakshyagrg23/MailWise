import { getAuthenticatedClient } from '../../services/googleAuthService.js';
import { buildRawMessage } from '../../utils/gmail/mimeBuilder.js';
import { HttpError, badRequest } from '../../utils/http/httpErrors.js';
import { DRAFT_ID_RE } from '../../utils/http/params.js';

/**
 * POST /api/v1/emails/send   { to, subject, body, cc?, bcc?, draftId? }
 * Sends one message. When `draftId` is given, that draft is removed afterwards (best effort).
 */
export const sendEmail = async (req, res) => {
    if (req.user.isDemo) {
        return res.json({ message: 'Email sent successfully' });
    }

    const { to, subject = '', body = '', cc, bcc, draftId } = req.body || {};
    const { gmail, user } = await getAuthenticatedClient({ userId: req.user.id });

    let raw;
    try {
        raw = buildRawMessage({
            from: user?.email || 'me',
            to,
            subject,
            body,
            reqBody: { cc, bcc },
        });
    } catch (err) {
        if (err.isValidation) throw badRequest(err.message);
        throw err;
    }

    try {
        await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    } catch (err) {
        if (err?.code === 403) throw err; // missing scope: central handler asks the user to re-login
        console.error('Error sending email:', err);
        throw new HttpError(502, 'Failed to send email');
    }

    // Sending a composed draft: remove the now-redundant draft (best effort)
    if (typeof draftId === 'string' && DRAFT_ID_RE.test(draftId)) {
        try {
            await gmail.users.drafts.delete({ userId: 'me', id: draftId });
        } catch (draftErr) {
            console.warn('Could not delete draft after send:', draftErr.message);
        }
    }

    return res.json({ message: 'Email sent successfully' });
};
