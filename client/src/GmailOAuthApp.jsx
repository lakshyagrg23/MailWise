import React, { useState } from "react";
import { motion } from "framer-motion";

function EmailWiseConnect({ setAuthenticated }) {
  const [loading, setLoading] = useState(false);

  const startOAuthFlow = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/auth/url");
      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error("OAuth Flow Error:", error);
      setLoading(false);
    }
  };

  // Variants for the container and floating elements
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.6 } },
  };

  const floatingVariant1 = {
    animate: {
      y: [0, -30, 0],
      transition: { repeat: Infinity, duration: 6, ease: "easeInOut" },
    },
  };

  const floatingVariant2 = {
    animate: {
      y: [-10, 20, -10],
      transition: { repeat: Infinity, duration: 5, ease: "easeInOut" },
    },
  };

  const buttonVariants = {
    hover: { scale: 1.1, boxShadow: "0px 4px 20px rgba(255,255,255,0.3)" },
    tap: { scale: 0.95 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#090D29] via-[#131A49] to-[#3E4BA0] text-white overflow-hidden"
    >
      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 flex justify-between opacity-40 pointer-events-none">
        <motion.div
          variants={floatingVariant1}
          animate="animate"
          className="w-32 h-32 bg-[#3E4BA0] opacity-50 rounded-full blur-3xl"
        ></motion.div>
        <motion.div
          variants={floatingVariant2}
          animate="animate"
          className="w-32 h-32 bg-[#E37B63] opacity-50 rounded-full blur-3xl"
        ></motion.div>
      </div>

      {/* Logo and Branding */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="flex flex-col items-center mb-8"
      >
        <div className="w-24 h-24 bg-gradient-to-r from-[#3E4BA0] to-[#E37B63] rounded-full flex items-center justify-center shadow-xl shadow-[#131A49]">
          <span className="text-3xl font-bold">M</span>
        </div>
        <h2 className="text-lg font-bold text-gray-300 tracking-widest mt-2">
          MAILWISE
        </h2>
        <p className="text-sm text-[#E37B63] font-medium tracking-wide">
          AI-Powered Email Management
        </p>
      </motion.div>

      {/* Heading & Tagline */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="text-5xl font-extrabold text-white text-center mb-4 drop-shadow-lg"
      >
        Welcome to MailWise
      </motion.h1>
      <p className="text-lg text-gray-300 text-center px-6">
        Elevate your email experience with AI-driven organization.
      </p>

      {/* Google Sign-in Button with 3D Hover Effect */}
      <motion.button
        onClick={startOAuthFlow}
        disabled={loading}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
        className="relative mt-8 bg-[#3E4BA0] px-8 py-4 rounded-xl shadow-md shadow-[#131A49] text-white font-semibold flex items-center space-x-3 transition-all duration-300 disabled:opacity-50"
      >
        {loading ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="h-5 w-5 border-2 border-white border-t-transparent rounded-full"
            ></motion.div>
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <motion.img
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              src="https://img.icons8.com/?size=100&id=17950&format=png&color=ffffff"
              alt="Google Logo"
              className="w-6 h-6"
            />
            <span>Sign in with Google</span>
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

export default EmailWiseConnect;
