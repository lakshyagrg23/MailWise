import { clearSession } from '../../utils/session.js';

export const logout = (req, res) => {
    clearSession(res);
    return res.json({ message: 'Logged out' });
};
