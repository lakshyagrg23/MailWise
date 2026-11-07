/* eslint-disable no-unused-vars */
import React, { Suspense, useEffect, useState, createContext, lazy } from 'react';
import { Navigate, Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import GmailOAuthApp from './GmailOAuthApp';
import fetchEmails from './api/api';
import http, { setUnauthorizedHandler } from './api/http';
import Error from './components/error/Error';
import SuspenseLoader from './components/error/SuspenseLoader';

const Main = lazy(() => import('./pages/Main'));
const Email = lazy(() => import('./components/Email'));
const ViewEmails = lazy(() => import('./components/ViewEmails'));

export const emailContext = createContext();

// Redirect targets must be absolute. A relative target inside the catch-all
// resolves against the current URL and re-matches the catch-all forever
// (/email/emails/inbox/emails/inbox/...).
const DEFAULT_ROUTE = "/emails/inbox";

// Created once at module level so it is not rebuilt on every App render.
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/" element={<Main />}>
        <Route index element={<Navigate to={DEFAULT_ROUTE} replace />} />
        <Route path="emails/:type" element={<Email />} Error={<Error />} />
        <Route path="view" element={<ViewEmails />} Error={<Error />} />
      </Route>
      <Route path="*" element={<Navigate to={DEFAULT_ROUTE} replace />} />
    </Route>
  )
);

const App = () => {
  const [emails, setEmails] = useState([]);
  const [messageSent, setmessageSent] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [category, setCategory] = useState("All");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [picture, setPicture] = useState("");
  const [categories, setCategories] = useState([{ name: "All", title: "All Emails" }]);
  const [data, setData] = useState({});
  const [openAi, setOpenAi] = useState(false);
  const [date, setDate] = useState(new Date());
  const [newMailsLoaded, setNewMailsLoaded] = useState(false);
  const [mailsReceived, setMailsReceived] = useState(false);
  const [message, setMessage] = useState("");
  const [update, setUpdate] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [draftsVersion, setDraftsVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const resetSession = () => {
    setAuthenticated(false);
    setSelectedUser("");
    setName("");
    setEmail("");
    setPicture("");
    setEmails([]);
    setSelectedEmails([]);
    setCategories([{ name: "All", title: "All Emails" }]);
    setCategory("All");
    setLoaded(false);
  };

  // Any 401 from the API returns the user to the login screen
  useEffect(() => {
    setUnauthorizedHandler(resetSession);
    return () => setUnauthorizedHandler(null);
  }, []);

  // Bootstrap the session from the HttpOnly cookie
  useEffect(() => {
    let cancelled = false;
    http.get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        const u = res.data || {};
        setSelectedUser(u.id || "");
        setName(u.name || "User");
        if (u.email) setEmail(u.email);
        if (u.pic) setPicture(u.pic);
        setAuthenticated(true);
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (emails.length === 0 && authenticated) {
      fetchEmailData(category);
    }
  }, [authenticated, category, selectedUser]);

  const fetchEmailData = async (cat) => {
    if (!authenticated) return;

    const result = await fetchEmails(cat);
    const { emails: fetchedEmails, email: userEmail, pic } = result || {};

    setEmails(Array.isArray(fetchedEmails) ? fetchedEmails : []);
    if (userEmail) setEmail(userEmail);
    if (pic) setPicture(pic);
    setLoaded(true);
  };

  // Gmail-style refresh: pull new mail in place (no page reload). The inbox list always holds
  // "All" and is filtered client-side; Sent/Drafts refetch through the draftsVersion bump.
  const refreshMail = async () => {
    if (!authenticated || refreshing) return;
    setRefreshing(true);
    try {
      const result = await fetchEmails("All");
      if (!result.error) {
        setEmails(Array.isArray(result.emails) ? result.emails : []);
        if (result.email) setEmail(result.email);
        if (result.pic) setPicture(result.pic);
      }
      setDraftsVersion((v) => v + 1);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Suspense fallback={<SuspenseLoader />}>
      <emailContext.Provider value={{
        emails, setEmails, category, setCategory, loaded, setLoaded,
        selectedUser, setSelectedUser, name, setName,
        selectedEmails, setSelectedEmails, setAuthenticated, resetSession,
        categories, setCategories, messageSent, setmessageSent,
        data, setData, openAi, setOpenAi, email, setEmail, picture,
        setPicture, date, setDate, newMailsLoaded, setNewMailsLoaded,
        mailsReceived, setMailsReceived, message, setMessage,
        update, setUpdate, fetchEmailData,
        composeOpen, setComposeOpen, draftsVersion, setDraftsVersion,
        refreshMail, refreshing
      }}>
        {checkingSession ? (
          <SuspenseLoader />
        ) : !authenticated ? (
          <GmailOAuthApp setAuthenticated={setAuthenticated} />
        ) : (
          <RouterProvider router={router} />
        )}
      </emailContext.Provider>
    </Suspense>
  );
};

export default App;
