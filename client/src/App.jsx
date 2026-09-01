/* eslint-disable no-unused-vars */
import React, { Suspense, useEffect, useState, createContext, lazy } from 'react';
import { Navigate, Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import GmailOAuthApp from './GmailOAuthApp';
import fetchEmails from './api/api';
import Error from './components/error/Error';
import SuspenseLoader from './components/error/SuspenseLoader';

const Main = lazy(() => import('./pages/Main'));
const Email = lazy(() => import('./components/Email'));
const ViewEmails = lazy(() => import('./components/ViewEmails'));

export const emailContext = createContext();

const App = () => {
  const [emails, setEmails] = useState([]);
  const [messageSent, setmessageSent] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
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

  // Initialize and persist authentication state
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("access_token");
    const userIdFromUrl = urlParams.get("user_id");
    const userNameFromUrl = urlParams.get("name");

    if (tokenFromUrl && userIdFromUrl) {
      const decodedName = userNameFromUrl ? decodeURIComponent(userNameFromUrl) : "User";
      localStorage.setItem("mailwise_token", tokenFromUrl);
      localStorage.setItem("mailwise_user_id", userIdFromUrl);
      localStorage.setItem("mailwise_user_name", decodedName);

      setAuthenticated(true);
      setAccessToken(tokenFromUrl);
      setSelectedUser(userIdFromUrl);
      setName(decodedName);

      // Clean the URL bar so the sensitive token is not exposed
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Check localStorage for existing session
      const savedToken = localStorage.getItem("mailwise_token");
      const savedUserId = localStorage.getItem("mailwise_user_id");
      const savedName = localStorage.getItem("mailwise_user_name") || "User";

      if (savedToken && savedUserId) {
        setAuthenticated(true);
        setAccessToken(savedToken);
        setSelectedUser(savedUserId);
        setName(savedName);
      }
    }
  }, []);

  useEffect(() => {
    const activeToken = accessToken || localStorage.getItem("mailwise_token");
    const activeUserId = selectedUser || localStorage.getItem("mailwise_user_id");

    if (emails.length === 0 && authenticated && activeToken && activeUserId) {
      fetchEmailData(category);
    }
  }, [authenticated, category, accessToken, selectedUser]);

  const fetchEmailData = async (cat) => {
    const activeUserId = selectedUser || localStorage.getItem("mailwise_user_id");
    const activeToken = accessToken || localStorage.getItem("mailwise_token");

    if (!activeUserId || !activeToken) return;

    const result = await fetchEmails(cat, activeToken, activeUserId, date);
    const { emails: fetchedEmails, email: userEmail, pic, activeToken: newActiveToken } = result || {};

    if (newActiveToken && newActiveToken !== activeToken) {
      localStorage.setItem("mailwise_token", newActiveToken);
      setAccessToken(newActiveToken);
    }

    setEmails(Array.isArray(fetchedEmails) ? fetchedEmails : []);
    if (userEmail) setEmail(userEmail);
    if (pic) setPicture(pic);
    setLoaded(true);
  };

  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route>
        <Route path="/" element={<Navigate to={`/email`} />} />
        <Route path="/" element={<Main />}>
          <Route path={`emails/:type`} element={<Email />} Error={<Error />} />
          <Route path={'/view'} element={<ViewEmails />} Error={<Error />} />
        </Route>
        <Route path={"/*"} element={<Navigate to={`emails/inbox`} />} />
      </Route>
    )
  );

  return (
    <Suspense fallback={<SuspenseLoader />}>
      <emailContext.Provider value={{
        emails, setEmails, category, setCategory, loaded, setLoaded,
        selectedUser, setSelectedUser, name, setName,
        selectedEmails, setSelectedEmails, accessToken,
        categories, setCategories, messageSent, setmessageSent,
        data, setData, openAi, setOpenAi, email, setEmail, picture,
        setPicture, date, setDate, newMailsLoaded, setNewMailsLoaded,
        mailsReceived, setMailsReceived, message, setMessage,
        update, setUpdate, fetchEmailData
      }}>
        {!authenticated ? (
          <GmailOAuthApp setAuthenticated={setAuthenticated} />
        ) : (
          <RouterProvider router={router} />
        )}
      </emailContext.Provider>
    </Suspense>
  );
};

export default App;
