/* eslint-disable no-unused-vars */
import React, { Suspense, useEffect, useState } from 'react';
import { Navigate, Route, createBrowserRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import { routes } from './routes/route';
import { createContext } from 'react'
import GmailOAuthApp from './GmailOAuthApp';
import fetchEmails from './api/api';
import Error from './components/error/Error';
import SuspenseLoader from './components/error/SuspenseLoader';

export const emailContext=createContext();

const App = () => {
  const [emails, setEmails] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded,setLoaded]=useState(false);
  const [accessToken, setAccessToken] = useState(null);
  const [category,setCategory]=useState("All") // Default category

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("access_token");
    console.log(token)
    if (token) {
      setAuthenticated(true);
      setAccessToken(token);
    }
  }, []);

  useEffect(() => {
    if (emails.length===0 && authenticated && accessToken) {
      fetchEmailData(category);
    }
    // else console.log("not found")
  }, [authenticated, category, accessToken]);

  const fetchEmailData = async (category) => {
    const fetchedEmails = await fetchEmails(category, accessToken);
    setEmails(fetchedEmails);
    setLoaded(true);
    console.log(emails)
  };

  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route>
        <Route path={routes.main.path} element={<Navigate to={`${routes.email.path}/inbox`} />} />
        <Route path={routes.main.path} element={<routes.main.element />}>
          <Route path={`${routes.email.path}/:type`} element={<routes.email.element />} Error={<Error />} />
          <Route path={routes.view.path} element={<routes.view.element />} Error={<Error />} />
        </Route>
        <Route path={routes.invalid.path} element={<Navigate to={`${routes.email.path}/inbox`} />} />
      </Route>
    )
  );

  return (
    <Suspense fallback={<SuspenseLoader />}>
      <emailContext.Provider value={{emails,setEmails,category,setCategory,loaded,setLoaded,category,setCategory}}>
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
