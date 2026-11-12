import http, { API } from './http';

const draftPath = (id) => `${API}/drafts/${encodeURIComponent(id)}`;

/** Live Gmail drafts view: { emails, nextPageToken }. */
export const listDrafts = async (pageToken) => {
    const { data } = await http.get(`${API}/drafts`, { params: pageToken ? { pageToken } : undefined });
    return { emails: data?.emails || [], nextPageToken: data?.nextPageToken || null };
};

/** Full draft, to repopulate the compose window. */
export const getDraft = async (id) => (await http.get(draftPath(id))).data;

/** Creates a draft, or replaces it when draftId is given. Resolves to { draftId, saved }. */
export const saveDraft = async (draftId, draft) =>
    (draftId ? await http.put(draftPath(draftId), draft) : await http.post(`${API}/drafts`, draft)).data;

export const deleteDraft = async (id) => (await http.delete(draftPath(id))).data;
