import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { emailContext } from '../App';

const Auto_email = () => {
    const { data, setData, openAi, setOpenAi } = useContext(emailContext);
    const [type, setType] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/fetch-email/email`, {
                params: { type: type, details: description },
            });
            console.log(response.data);
            setData(response.data);
            setTimeout(() => {
                setData(response.data);
                setOpenAi(false);
            }, 1000);
        } catch (error) {
            console.error('Error fetching email body:', error);
        }
    };

    useEffect(() => {
        console.log('Updated data:', data);
    }, [data]);

    return (
        <div className="flex items-center justify-center h-130 bg-gradient-to-br from-[#1B1F3B] via-[#2A2E65] to-[#1B1F3B] px-4 relative overflow-hidden">
            {/* Stars Layer */}
            <div className="absolute top-0 left-0 w-full h-full bg-[url('/stars.gif')] opacity-10 z-0" />

            <form
                onSubmit={handleSubmit}
                className="relative z-10 backdrop-blur-lg bg-white/5 border border-white/10 shadow-2xl rounded-3xl p-10 w-full max-w-xl space-y-8"
            >
                <h2 className="text-3xl font-bold text-white text-center tracking-wide drop-shadow-glow">
                    🌌 Auto Email Generator
                </h2>

                {/* Type Selection */}
                <div>
                    <label htmlFor="type" className="block text-white/80 mb-2 font-medium tracking-wide">
                        Type of Email
                    </label>
                    <select
                        id="type"
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        required
                        className="w-full bg-transparent text-white border border-white/30 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="">Select Type</option>
                        <option value="formal">Formal</option>
                        <option value="informal">Informal</option>
                    </select>
                </div>

                {/* Description */}
                <div>
                    <label htmlFor="description" className="block text-white/80 mb-2 font-medium tracking-wide">
                        Description
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what the email should include..."
                        required
                        rows={6}
                        className="w-full bg-transparent text-white border border-white/30 rounded-xl px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-white/50"
                    />
                </div>

                {/* Submit Button */}
                <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#FF6EC7] to-[#6A5ACD] hover:from-[#e35aae] hover:to-[#584ac9] text-white font-bold py-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                    🚀 Generate Email
                </button>
            </form>
        </div>
    );
};

export default Auto_email;
