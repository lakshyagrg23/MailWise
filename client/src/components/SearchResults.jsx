import React, { useContext, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { emailContext } from "../App";
import DisplayEmail from "./DisplayEmail";

const SearchResults = ({ searchQuery, setShowSearchResults }) => {
    const { emails } = useContext(emailContext);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const searchResultsRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchResultsRef.current && !searchResultsRef.current.contains(event.target)) {
                setShowSearchResults(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [setShowSearchResults]);

    if (!searchQuery) return null; // Now safe to use after hooks are declared

    const searchWords = searchQuery.toLowerCase().split(" ").filter(Boolean);
    const filteredEmails = emails.filter((email) =>
        searchWords.some(
            (word) =>
                (email.subject && email.subject.toLowerCase().includes(word)) || 
                (email.body && email.body.toLowerCase().includes(word))
        )
    );

    const ViewtheEmail = (email) => {
        setSelectedEmail(email);
    };

    return (
        <div 
            ref={searchResultsRef} 
            className="absolute left-0 w-full max-w-2xl top-full mt-0 bg-white bg-opacity-40 backdrop-blur-lg shadow-lg rounded-lg p-4 z-50 max-h-96 overflow-y-auto"
        >
            <h2 className="text-lg font-bold text-gray-800 mb-2">
                Search Results:
            </h2>

            {filteredEmails.length > 0 ? (
                filteredEmails.map((email) => (
                    <motion.div
                        key={email._id}
                        className="bg-gray-100 p-3 my-2 rounded-md shadow cursor-pointer hover:bg-gray-200"
                        whileHover={{ scale: 1.02 }}
                        onClick={() => ViewtheEmail(email)}
                    >
                        <DisplayEmail email={email} />
                    </motion.div>
                ))
            ) : (
                <p className="text-gray-500 text-xl text-center">
                    No matching emails found.
                </p>
            )}

            {selectedEmail && <DisplayEmail email={selectedEmail} />}
        </div>
    );
};

export default SearchResults;
