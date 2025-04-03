import React, { useState,useContext } from "react";
import { useNavigate } from "react-router-dom";
import { emailContext } from "../App";

const UserSelection = () => {
    const choose=useContext(emailContext)
    const navigate = useNavigate();

    const userRoles = [
        { label: "Student", img: "./images/student.png" },
        { label: "Educator", img: "./images/educator.png" },
        { label: "Corporate Professional", img: "./images/corporate.png" },
        { label: "Entrepreneur", img: "./images/entrepreneur.png" },
        { label: "Freelancer / Consultant", img: "./images/freelancer.png" },
        { label: "Researcher / Scientist", img: "./images/researcher.png" },
        { label: "Creative Professional", img: "./images/creative.png" },
        { label: "Healthcare Professional", img: "./images/healthcare.png" },
        { label: "Government / Public Sector", img: "./images/government.png" },
        { label: "Tech Professional", img: "./images/tech.png" }
    ];

    const handleSelection = () => {
        if (choose.name && choose.selectedUser) {
            // console.log("User Info:", { name, selectedUser });
            navigate("/emails");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-indigo-500 to-blue-700 text-white p-8">
            <div className="bg-white p-10 rounded-xl shadow-2xl text-gray-800 w-full max-w-lg">
                <h1 className="text-4xl font-extrabold mb-8 text-center text-gray-900">Welcome! Tell us about yourself</h1>
                <input
                type="text"
                placeholder="Enter your name or alias"
                className="w-full p-4 border rounded-lg mb-8 focus:outline-none focus:ring-4 focus:ring-indigo-400 shadow-sm"
                value={choose.name}
                onChange={(e) => choose.setName(e.target.value)}
                />
                <h2 className="text-xl font-bold mb-4 text-gray-800">Select Your Role</h2>
                <div className="relative w-full mb-10">
                <select
                    className="w-full p-4 border rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-400 shadow-sm"
                    value={choose.selectedUser}
                    onChange={(e) => choose.setSelectedUser(e.target.value)}
                >
                    <option value="" disabled>Select your role</option>
                    {userRoles.map((role) => (
                    <option key={role.label} value={role.label}>{role.label}</option>
                    ))}
                </select>
                {choose.selectedUser && (
                    <div className="flex items-center mt-6 bg-gray-100 p-4 rounded-lg shadow-md">
                    <img src={userRoles.find(role => role.label === choose.selectedUser)?.img} alt={choose.selectedUser} className="w-14 h-14 mr-5 rounded-full" />
                    <span className="text-lg font-semibold text-gray-900">{choose.selectedUser}</span>
                    </div>
                )}
                </div>
                <button
                className="mt-12 w-full px-8 py-4 bg-green-500 text-white rounded-lg text-xl font-bold hover:bg-green-600 transition-all duration-300 disabled:bg-gray-300 shadow-lg"
                onClick={handleSelection}
                disabled={!choose.name || !choose.selectedUser}
                >
                Confirm & Proceed
                </button>
            </div>
        </div>
    );
};

export default UserSelection;