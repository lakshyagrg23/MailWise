import React, { useState } from 'react';

function GmailOAuthApp({ setAuthenticated }) {
    const [loading, setLoading] = useState(false);

    const startOAuthFlow = async () => {
        setLoading(true);
        const response = await fetch('http://localhost:5000/auth/url');
        const { authUrl } = await response.json();
        window.location.href = authUrl;
    };

    return (
        <div className="flex items-center justify-center h-screen bg-gray-100">
            <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row bg-white shadow-xl rounded-lg overflow-hidden">
                {/* Left Side - Hero Text */}
                <div className="flex-1 p-8 flex flex-col justify-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                    <h1 className="text-4xl font-extrabold mb-4 leading-tight">Welcome to MailWise</h1>
                    <p className="text-lg mb-6">
                        Experience AI-powered email organization. Categorize your Gmail inbox into
                        Essential, Social, Promotions, Finance, Updates, and more.
                    </p>
                    <p className="text-sm opacity-90">
                        🔒 We only access your inbox to classify your emails. No data is stored on our servers.
                    </p>
                </div>

                {/* Right Side - Sign In Box */}
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                        <h2 className="text-2xl font-bold mb-4 text-gray-800">Get Started</h2>
                        <p className="text-gray-600 mb-6">
                            Connect your Gmail account to unlock smart email categorization.
                        </p>

                        <button
                            onClick={startOAuthFlow}
                            disabled={loading}
                            className="inline-flex items-center justify-center bg-blue-600 text-white font-medium px-6 py-3 rounded-md hover:bg-blue-700 transition disabled:opacity-70"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"
                                        />
                                    </svg>
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <img
                                        src="https://img.icons8.com/?size=100&id=17950&format=png&color=0000000"
                                        alt="Google Logo"
                                        className="w-5 h-5 mr-2"
                                    />
                                    Continue with Google
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GmailOAuthApp;
