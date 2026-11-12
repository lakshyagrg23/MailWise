import { issueOAuthState } from '../../utils/session.js';
import { createOAuth2Client } from '../../services/googleAuthService.js';

export const url = (req, res) => {
    const oauth2Client = createOAuth2Client();
    const state = issueOAuthState(res);
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        state,
        scope: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            'https://www.googleapis.com/auth/gmail.send',
            // Needed to create/update/delete drafts (readonly can list/read them but not write)
            'https://www.googleapis.com/auth/gmail.compose',
            // Needed to add/remove the UNREAD label so read state stays in sync with Gmail
            'https://www.googleapis.com/auth/gmail.modify'
        ],
    });
    res.json({ authUrl });
};
