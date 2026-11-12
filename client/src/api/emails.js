import http, { API } from './http';

const emailPath = (id) => `${API}/emails/${encodeURIComponent(id)}`;

/** Stored (already classified) mail from the database. Read-only. Resolves to an array. */
export const listEmails = async (category = 'All') =>
    (await http.get(`${API}/emails`, { params: { category } })).data?.emails || [];

/** Pull and classify new mail from Gmail. Call listEmails afterwards to read the result. */
export const syncEmails = async () => (await http.post(`${API}/emails/sync`)).data;

/** One email read live from Gmail: { email: { body, attachments: [{ partId, filename, ... }], ... } }. */
export const getEmail = async (id) => (await http.get(emailPath(id))).data;

/** Set read/starred state: patch is { is_read?: boolean, is_starred?: boolean }. */
export const updateEmail = async (id, patch) => (await http.patch(emailPath(id), patch)).data;

/** Generate (or fetch the cached) AI summary: { summary, isCached }. */
export const summarizeEmail = async (id) => (await http.post(`${emailPath(id)}/summary`)).data;

/** Send a message: { to, cc?, bcc?, subject, body, draftId? }. */
export const sendEmail = async (message) => (await http.post(`${API}/emails/send`, message)).data;

/** Attachment bytes as a Blob. A blob request keeps the session cookie on the call. */
export const downloadAttachment = async (emailId, partId) =>
    (await http.get(`${emailPath(emailId)}/attachments/${encodeURIComponent(partId)}`, { responseType: 'blob' })).data;

/** Live Gmail "sent" view: { emails, nextPageToken }. */
export const listSent = async (pageToken) => {
    const { data } = await http.get(`${API}/sent`, { params: pageToken ? { pageToken } : undefined });
    return { emails: data?.emails || [], nextPageToken: data?.nextPageToken || null };
};
