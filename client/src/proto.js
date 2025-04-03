import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import fetchEmails from './api/api';
import Sidebar from './components/SideBar';
import EmailList from './components/EmailList';
import GmailOAuthApp from './GmailOAuthApp';

const App = () => {
  const [emails, setEmails] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const { type } = 'Essential';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("access_token");

    if (token) {
      setAuthenticated(true);
      setAccessToken(token);
    }
  }, []);

  useEffect(() => {
    if (authenticated && accessToken) {
      fetchEmailData(type);
    }
  }, [authenticated, type, accessToken]);

  const fetchEmailData = async (category) => {
    const fetchedEmails = await fetchEmails(category, accessToken);
    setEmails(fetchedEmails);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={authenticated ? (
            <div className="flex">
              <Sidebar />
              <EmailList emails={emails} />
            </div>
          ) : (
            <GmailOAuthApp setAuthenticated={setAuthenticated} />
          )}
        />
      </Routes>
    </Router>
  );
};

export default App;
