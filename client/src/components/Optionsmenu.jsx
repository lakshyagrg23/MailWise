import http from "../api/http";
import React, { useState, useContext } from "react";
import { emailContext } from "../App";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Typography, Button } from "@mui/material";
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LogoutIcon from '@mui/icons-material/Logout';

const flyIn = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
};

const OptionsMenu = () => {
  const { name, email, picture, resetSession } = useContext(emailContext);
  const [helpOpen, setHelpOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const logout = async () => {
    try {
      await http.post("/auth/logout");
    } catch (error) {
      console.error("Logout error:", error);
    }
    resetSession();
  };

  const displayName = name || "User";

  return (
    <div className="fixed top-3 right-4 z-50 flex items-center gap-3 font-sans">
      {/* Help Button */}
      <div
        onClick={() => {
          setHelpOpen(!helpOpen);
          setPanelOpen(false);
        }}
        className="relative w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors border border-slate-200"
      >
        <HelpOutlineIcon sx={{ fontSize: 18 }} />
        <AnimatePresence>
          {helpOpen && (
            <motion.div
              variants={flyIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-12 right-0 bg-white text-slate-800 p-5 rounded-2xl w-80 shadow-xl border border-slate-200"
              style={{ fontWeight: 400 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Typography sx={{ fontWeight: 700, fontSize: "16px", mb: 1.5, color: "#0f172a" }}>
                Quick Tips
              </Typography>
              <ul className="text-xs space-y-2 text-slate-600 leading-relaxed list-disc list-inside">
                <li>Click the sparkle icon on any email for an instant AI summary.</li>
                <li>Manage and customize categories in the left sidebar.</li>
                <li>Search across subject, sender, and content in real-time.</li>
                <li>Use AI Draft Assistant to compose emails with custom tones.</li>
              </ul>
              <Button
                fullWidth
                size="small"
                variant="contained"
                onClick={() => setHelpOpen(false)}
                sx={{
                  mt: 2.5,
                  backgroundColor: "#2563eb",
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                  boxShadow: "none",
                  "&:hover": { backgroundColor: "#1d4ed8" }
                }}
              >
                Got it
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Avatar Button */}
      <div
        onClick={() => {
          setPanelOpen(!panelOpen);
          setHelpOpen(false);
        }}
        className="relative cursor-pointer"
      >
        <Avatar
          src={picture}
          sx={{
            width: 36,
            height: 36,
            border: "2px solid #e2e8f0",
            backgroundColor: "#2563eb",
            fontSize: "14px",
            fontWeight: 600
          }}
        >
          {displayName[0]?.toUpperCase() || "U"}
        </Avatar>
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              variants={flyIn}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="absolute top-12 right-0 bg-white text-slate-900 p-4 rounded-2xl w-72 shadow-xl border border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <Avatar
                  src={picture}
                  sx={{
                    width: 44,
                    height: 44,
                    backgroundColor: "#2563eb",
                    fontSize: "16px",
                    fontWeight: 600
                  }}
                >
                  {displayName[0]?.toUpperCase() || "U"}
                </Avatar>
                <div className="overflow-hidden">
                  <Typography sx={{ fontWeight: 700, fontSize: "14.5px", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {displayName}
                  </Typography>
                  <Typography sx={{ fontSize: "12px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {email || "Connected with Google"}
                  </Typography>
                </div>
              </div>

              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
                onClick={logout}
                sx={{
                  mt: 2,
                  borderColor: "#fca5a5",
                  color: "#dc2626",
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                  "&:hover": {
                    borderColor: "#dc2626",
                    backgroundColor: "#fef2f2"
                  }
                }}
              >
                Sign Out
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default OptionsMenu;
