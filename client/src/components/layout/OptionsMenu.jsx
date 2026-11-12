import { logout as apiLogout } from "../../api/auth";
import React, { useState, useContext, useEffect, useRef } from "react";
import { emailContext } from "../../context/emailContext";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Box, Typography, Button, IconButton, Tooltip } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import LogoutIcon from "@mui/icons-material/Logout";

const flyIn = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } },
};

const panelSx = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  zIndex: 1400,
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
};

const TIPS = [
  ["Sparkle icon", "gets an instant AI summary of any email"],
  ["Star / envelope", "star an email or mark it read/unread from its row"],
  ["Pin a category", "hover it in the sidebar to keep it at the top"],
  ["Press /", "to jump to search from anywhere"],
];

// Renders its panel while open and closes on outside click or Escape
const useDismiss = (open, setOpen) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  return ref;
};

const OptionsMenu = () => {
  const { name, email, picture, resetSession } = useContext(emailContext);
  const [helpOpen, setHelpOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const helpRef = useDismiss(helpOpen, setHelpOpen);
  const panelRef = useDismiss(panelOpen, setPanelOpen);

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    resetSession();
  };

  const displayName = name || "User";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontFamily: "'Inter', sans-serif" }}>
      {/* Help */}
      <Box ref={helpRef} sx={{ position: "relative" }}>
        <Tooltip title="Tips">
          <IconButton
            onClick={() => {
              setHelpOpen((o) => !o);
              setPanelOpen(false);
            }}
            aria-label="Tips"
            sx={{ color: "#475569", "&:hover": { backgroundColor: "#f1f5f9", color: "#0f172a" } }}
          >
            <HelpOutlineIcon sx={{ fontSize: 21 }} />
          </IconButton>
        </Tooltip>

        <AnimatePresence>
          {helpOpen && (
            <Box component={motion.div} variants={flyIn} initial="hidden" animate="visible" exit="exit"
              sx={{ ...panelSx, width: 320, p: 2.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "16px", mb: 1.5, color: "#0f172a" }}>
                Quick tips
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                {TIPS.map(([lead, rest]) => (
                  <Typography key={lead} sx={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
                    <b style={{ color: "#0f172a", fontWeight: 600 }}>{lead}</b> {rest}
                  </Typography>
                ))}
              </Box>
              <Button
                fullWidth
                size="small"
                variant="contained"
                onClick={() => setHelpOpen(false)}
                disableElevation
                sx={{
                  mt: 2.5,
                  backgroundColor: "#2563eb",
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                  "&:hover": { backgroundColor: "#1d4ed8" },
                }}
              >
                Got it
              </Button>
            </Box>
          )}
        </AnimatePresence>
      </Box>

      {/* Account */}
      <Box ref={panelRef} sx={{ position: "relative", ml: 0.5 }}>
        <IconButton
          onClick={() => {
            setPanelOpen((o) => !o);
            setHelpOpen(false);
          }}
          aria-label="Account"
          sx={{ p: 0.25 }}
        >
          <Avatar
            src={picture}
            sx={{
              width: 36,
              height: 36,
              border: panelOpen ? "2px solid #2563eb" : "2px solid #e2e8f0",
              backgroundColor: "#2563eb",
              fontSize: "14px",
              fontWeight: 600,
              transition: "border-color 0.15s ease",
            }}
          >
            {displayName[0]?.toUpperCase() || "U"}
          </Avatar>
        </IconButton>

        <AnimatePresence>
          {panelOpen && (
            <Box component={motion.div} variants={flyIn} initial="hidden" animate="visible" exit="exit"
              sx={{ ...panelSx, width: 300, p: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, pb: 1.75, borderBottom: "1px solid #f1f5f9" }}>
                <Avatar
                  src={picture}
                  sx={{ width: 46, height: 46, backgroundColor: "#2563eb", fontSize: "17px", fontWeight: 600 }}
                >
                  {displayName[0]?.toUpperCase() || "U"}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700, fontSize: "14.5px", color: "#0f172a" }}>
                    {displayName}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: "12.5px", color: "#64748b" }}>
                    {email || "Connected with Google"}
                  </Typography>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<LogoutIcon sx={{ fontSize: 17 }} />}
                onClick={logout}
                sx={{
                  mt: 1.75,
                  borderColor: "#e2e8f0",
                  color: "#475569",
                  textTransform: "none",
                  fontWeight: 600,
                  borderRadius: 2,
                  "&:hover": { borderColor: "#fca5a5", color: "#dc2626", backgroundColor: "#fef2f2" },
                }}
              >
                Sign out
              </Button>
            </Box>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};

export default OptionsMenu;
