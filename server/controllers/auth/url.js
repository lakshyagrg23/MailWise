import { issueOAuthState } from '../../utils/session.js';

export const url = (oauth2Client) => (req, res) => {
    const state = issueOAuthState(res);
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        state,
        scope: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            'https://www.googleapis.com/auth/gmail.send'
        ],
    });
    res.json({ authUrl });
};
