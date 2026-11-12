import http, { API } from './http';

/** The user's categories: [{ id, name, description }]. */
export const listCategories = async () => (await http.get(`${API}/categories`)).data;

/** Create: { name, description }. Resolves to the new category. */
export const createCategory = async (category) => (await http.post(`${API}/categories`, category)).data;

/** Update by id: patch is { name?, description? }. Renaming also re-labels stored emails. */
export const updateCategory = async (id, patch) => (await http.patch(`${API}/categories/${id}`, patch)).data;

export const deleteCategory = async (id) => { await http.delete(`${API}/categories/${id}`); };
