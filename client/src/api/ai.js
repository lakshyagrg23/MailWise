import http, { API } from './http';

/** Turn a description into a draft. type: 'formal' | 'informal'. Resolves to { subject, body }. */
export const composeEmail = async ({ type, details }) =>
    (await http.post(`${API}/ai/compose`, { type, details })).data;
