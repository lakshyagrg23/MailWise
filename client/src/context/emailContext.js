import { createContext } from 'react';

// Shared mail/session state provided by App.jsx. Kept in its own module so components can import
// it without importing App (which itself lazy-loads those components).
export const emailContext = createContext();
