/* eslint-disable no-unused-vars */
import { useOutletContext, useParams } from "react-router-dom";
import { API_URLS } from "../api/api.url";
import useApi from "../hooks/useApi";
import { useState, useContext } from "react";
import { Box, List } from "@mui/material";
import DisplayEmail from "./DisplayEmail";
import NoMails from "./error/NoMails";
import { emailContext } from "../App";
import { motion } from "framer-motion";

const Email = () => {
    const [selectedEmails, setSelectedEmails] = useState([]);
    const { openDrawer } = useOutletContext();
    const getEmailService = useApi(API_URLS.getEmail);
    const emailhook = useContext(emailContext);

    console.log(emailhook);

    const emailList = getEmailService?.response || emailhook.emails;
    let filteredEmails =
        emailhook.category === "All"
            ? emailhook.emails
            : emailhook.emails.filter((email) => email.category === emailhook.category);

    return emailhook.emails && emailhook.emails.length > 0 ? (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="transition-all duration-500 bg-gradient-to-b from-gray-50 via-white to-gray-100 p-4 rounded-lg shadow-lg"
            style={openDrawer ? { marginLeft: 250, width: "calc(100%-250px)" } : { width: "100%" }}
        >
            <List>
                {filteredEmails.length > 0 ? (
                    filteredEmails.map((email, index) => (
                        <motion.div
                            key={email._id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            whileHover={{ scale: 1.02, backgroundColor: "#f0f4ff" }}
                            transition={{ delay: index * 0.1, duration: 0.4 }}
                            className="rounded-lg transition-all duration-300"
                        >
                            <DisplayEmail
                                email={email}
                                selectedEmails={selectedEmails}
                                setSelectedEmails={setSelectedEmails}
                            />
                        </motion.div>
                    ))
                ) : (
                    <NoMails />
                )}
            </List>
        </motion.div>
    ) : (
        <div className="flex flex-col items-center justify-center h-screen">
            {/* Pulsating Loader */}
            <motion.div
                className="rounded-full ml-151 h-12 w-12 border-t-4 border-blue-500 border-solid shadow-lg"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1 }}
                whileHover={{ scale: 1.1 }}
            ></motion.div>

            {/* Glowing Text Effect */}
            <motion.h1
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center items-center text-center ml-151 text-lg font-semibold text-gray-700"
                whileHover={{
                    textShadow: "0px 0px 10px rgba(0, 162, 255, 0.8)",
                    color: "#007bff",
                }}
            >
                Fetching and classifying your emails...
            </motion.h1>
        </div>
    );
};

export default Email;
