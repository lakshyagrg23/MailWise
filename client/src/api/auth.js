import http from './http';

// Auth endpoints are unversioned (/auth/*): Google registers the OAuth redirect URI.

/** Current session user: { id, name, email, pic, isDemo }. Rejects with 401 when signed out. */
export const getMe = async () => (await http.get('/auth/me')).data;

/** Google consent-screen URL to navigate to. */
export const getAuthUrl = async () => (await http.get('/auth/url')).data.authUrl;

/** Resets and signs in the shared demo account (sets the session cookie). */
export const startDemo = async () => (await http.post('/auth/demo')).data;

export const logout = async () => (await http.post('/auth/logout')).data;
