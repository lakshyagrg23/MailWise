/* eslint-disable no-unused-vars */
import { useOutletContext, useParams } from "react-router-dom";
import { API_URLS } from "../api/api.url";
import useApi from "../hooks/useApi";
import { useEffect, useState,useContext } from "react";
import { Box, List } from '@mui/material';
import DisplayEmail from "./DisplayEmail";
import { EMPTY_TABS } from "../assests/Assest";
import NoMails from "./error/NoMails";
import { emailContext } from "../App";
import  fetchEmails  from "../api/api"; // Ensure this is correctly defined in api.js

const Email = () => {
    const [selectedEmails, setSelectedEmails] = useState([]);

    const { openDrawer } = useOutletContext();
    const { type } = useParams();
    const getEmailService = useApi(API_URLS.getEmail);
    const moveEmailToBin = useApi(API_URLS.moveToBin);
    const deleteEmailService = useApi(API_URLS.deleteEmail);

    const emailhook=useContext(emailContext);
    console.log(emailhook)

    const emailList = getEmailService?.response || emailhook.emails; // Store the email list once
    let filteredEmails;
    if(emailhook.category==="All"){
        filteredEmails=emailhook.emails;
    }
    else{
        filteredEmails = emailhook.emails.filter(email => email.category === emailhook.category);
    }

    const selectAllEmails = (e) => {
        if (e.target.checked) {
            setSelectedEmails(emailList.map(email => email._id));
        } else {
            setSelectedEmails([]);
        }
    };

    const deleteEmails = () => {
        if (type === 'bin') {
            deleteEmailService.call(selectedEmails);
        } else {
            moveEmailToBin.call(selectedEmails);
        }
    };

    return (
        emailhook.loaded ? (
            <Box style={openDrawer ? { marginLeft: 250, width: 'calc(100%-250px)' } : { width: '100%' }}>
                <List>
                    {filteredEmails.length > 0 ? (
                        filteredEmails.map((email) => (
                            <DisplayEmail
                                key={`${Date.now()}-${Math.random()}`} 
                                email={email}
                                selectedEmails={selectedEmails}
                                setSelectedEmails={setSelectedEmails}
                            />
                        ))
                    ) : (
                        <NoMails />
                    )}
                </List>
            </Box>
        ) : (
            <div className="flex flex-col items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500 border-solid"></div>
                <h1 className="mt-4 text-lg font-semibold text-gray-700">Fetching and classifying your emails...</h1>
            </div>
        )
    );
    
};

export default Email;
