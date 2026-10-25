import axios from 'axios';

export const baseURL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const http = axios.create({ baseURL, withCredentials: true });

let unauthorizedHandler = null;

// App registers a callback that returns the UI to the login screen on 401.
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error?.config?.url || '';
    if (error?.response?.status === 401 && !url.includes('/auth/') && unauthorizedHandler) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export default http;
