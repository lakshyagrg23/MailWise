import React, { useState, useContext, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Collapse,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Tooltip,
  Typography
} from "@mui/material";
import { CreateOutlined } from "@mui/icons-material";
import TuneIcon from "@mui/icons-material/Tune";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import StarBorderRoundedIcon from "@mui/icons-material/StarBorderRounded";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import NewCategory from "./NewCategory";
import Compose from "./Compose";
import { NavLink } from "react-router-dom";
import { routes } from "../routes/route";
import { emailContext } from "../App";
import { getRandomColor } from "../content/getColor";
import { Refresh } from "./Refresh";
import http from "../api/http";

// Gmail-derived buckets: low priority, grouped and collapsed by default
const FILTERED = ["Promotions", "Social", "Spam"];
// Mailboxes (not categories) get their own always-visible group
const MAILBOXES = ["all", "starred", "sent", "drafts"];
// How many categories stay visible before the rest fold under "N more"
const VISIBLE_LIMIT = 5;
const PREFS_KEY = "mailwise_sidebar_v1";

const defaultPrefs = { usage: {}, pinned: [], filteredOpen: false, moreOpen: false };

const loadPrefs = () => {
  try {
    return { ...defaultPrefs, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
  } catch {
    return defaultPrefs;
  }
};

const sectionLabelSx = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.6
};

const NavItem = ({
  to, label, color, icon, count, active, muted, onClick, pinned, onTogglePin
}) => (
  <NavLink to={to} onClick={onClick} style={{ textDecoration: "none" }}>
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.5,
        py: 0.9,
        borderRadius: 2,
        cursor: "pointer",
        backgroundColor: active ? "#eff6ff" : "transparent",
        color: active ? "#2563eb" : muted ? "#64748b" : "#334155",
        transition: "background-color 0.15s ease",
        "&:hover": { backgroundColor: active ? "#eff6ff" : "#f8fafc" },
        "&:hover .pin-btn": { opacity: 1 }
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {icon ? (
          React.cloneElement(icon, { sx: { fontSize: 19, color: active ? "#2563eb" : "#64748b" } })
        ) : (
          <Box sx={{ width: 8, height: 8, ml: "5.5px", mr: "5.5px", borderRadius: "50%", flexShrink: 0, backgroundColor: color }} />
        )}
        <Typography
          noWrap
          sx={{ fontSize: "14px", fontWeight: active ? 600 : 500, color: "inherit" }}
        >
          {label}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        {onTogglePin && (
          <Tooltip title={pinned ? "Unpin" : "Pin to top"}>
            <IconButton
              className="pin-btn"
              size="small"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin();
              }}
              sx={{
                p: 0.25,
                opacity: pinned ? 1 : 0,
                color: pinned ? "#2563eb" : "#94a3b8",
                transition: "opacity 0.15s ease"
              }}
            >
              {pinned ? <PushPinIcon sx={{ fontSize: 15 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
        )}
        {count > 0 && (
          <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
            {count}
          </Typography>
        )}
      </Box>
    </Box>
  </NavLink>
);

const SectionHeader = ({ children, action, onClick, open, badge }) => (
  <Box
    onClick={onClick}
    sx={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      px: 1.5,
      mt: 2.5,
      mb: 0.5,
      cursor: onClick ? "pointer" : "default",
      userSelect: "none"
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {onClick && (open ? <ExpandMoreIcon sx={{ fontSize: 16, color: "#94a3b8" }} /> : <ChevronRightIcon sx={{ fontSize: 16, color: "#94a3b8" }} />)}
      <Typography sx={sectionLabelSx}>{children}</Typography>
    </Box>
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {badge > 0 && !open && (
        <Typography sx={{ fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>{badge}</Typography>
      )}
      {action}
    </Box>
  </Box>
);

const SideBarContent = () => {
  const categoryHook = useContext(emailContext);
  // Compose open-state lives in context so a draft row can open it too
  const openDialog = categoryHook.composeOpen;
  const setOpenDialog = categoryHook.setComposeOpen;
  const [openPopup, setOpenPopup] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs);

  const updatePrefs = useCallback((patch) => {
    setPrefs((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: preferences last for this session only */
      }
      return next;
    });
  }, []);

  const activeName = (categoryHook.category || "All").toLowerCase();

  const getCategoryCount = (categoryName) => {
    if (!categoryHook.emails || categoryHook.emails.length === 0) return 0;
    if (categoryName === "All") return categoryHook.emails.length;
    return categoryHook.emails.filter(
      (email) => email.category?.toLowerCase() === categoryName?.toLowerCase()
    ).length;
  };

  // Sidebar badges show unread mail (is_read === false), not totals
  const getUnreadCount = (categoryName) => {
    if (!categoryHook.emails || categoryHook.emails.length === 0) return 0;
    return categoryHook.emails.filter(
      (email) =>
        email.is_read === false &&
        (categoryName === "All" || email.category?.toLowerCase() === categoryName?.toLowerCase())
    ).length;
  };

  const onComposeClick = () => setOpenDialog(true);
  const handlePopupOpen = () => setOpenPopup(true);
  const handlePopupClose = () => setOpenPopup(false);

  const handleSave = async () => {
    Refresh();
    handlePopupClose();
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await http.get("/categories");
        categoryHook.setCategories([
          { name: "All", title: "All Emails" },
          ...response.data,
        ]);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    if (categoryHook.selectedUser) fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryHook.selectedUser]);

  const openCategory = (name) => {
    categoryHook.setCategory(name);
    updatePrefs((p) => ({ ...p, usage: { ...p.usage, [name]: (p.usage[name] || 0) + 1 } }));
  };

  const togglePin = (name) =>
    updatePrefs((p) => ({
      ...p,
      pinned: p.pinned.includes(name) ? p.pinned.filter((n) => n !== name) : [...p.pinned, name]
    }));

  // User categories only, ranked: pinned first, then most-opened, then most mail
  const { visible, folded } = useMemo(() => {
    const cats = (categoryHook.categories || [])
      .map((c) => c.name)
      .filter(
        (n) =>
          n &&
          !MAILBOXES.includes(n.toLowerCase()) &&
          !FILTERED.some((f) => f.toLowerCase() === n.toLowerCase())
      );

    const pinned = prefs.pinned.filter((n) => cats.includes(n));
    const rest = cats
      .filter((n) => !pinned.includes(n))
      .map((n, i) => ({ n, i, uses: prefs.usage[n] || 0, count: getCategoryCount(n) }))
      .sort((a, b) => b.uses - a.uses || b.count - a.count || a.i - b.i)
      .map((x) => x.n);

    const room = Math.max(0, VISIBLE_LIMIT - pinned.length);
    let shown = [...pinned, ...rest.slice(0, room)];
    let hidden = rest.slice(room);

    // The open category is never hidden; a lone leftover is shown rather than "1 more"
    const active = hidden.find((n) => n.toLowerCase() === activeName);
    if (active) {
      shown.push(active);
      hidden = hidden.filter((n) => n !== active);
    }
    if (hidden.length === 1) {
      shown.push(hidden[0]);
      hidden = [];
    }
    return { visible: shown, folded: hidden };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryHook.categories, categoryHook.emails, prefs.pinned, prefs.usage, activeName]);

  const categoryItem = (name) => (
    <NavItem
      key={name}
      to={`${routes.email.path}/${name}`}
      label={name}
      color={getRandomColor(name)}
      count={getUnreadCount(name)}
      active={activeName === name.toLowerCase()}
      onClick={() => openCategory(name)}
      pinned={prefs.pinned.includes(name)}
      onTogglePin={() => togglePin(name)}
    />
  );

  const filteredTotal = FILTERED.reduce((sum, n) => sum + getUnreadCount(n), 0);
  const filteredHasActive = FILTERED.some((n) => n.toLowerCase() === activeName);
  const filteredOpen = prefs.filteredOpen || filteredHasActive;
  const moreOpen = prefs.moreOpen;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        px: 2,
        py: 2.5,
        backgroundColor: "#ffffff",
        borderRight: "1px solid #e2e8f0",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Compose Button */}
      <Button
        variant="contained"
        onClick={onComposeClick}
        startIcon={<CreateOutlined />}
        sx={{
          backgroundColor: "#2563eb",
          color: "#ffffff",
          borderRadius: 2.5,
          py: 1.3,
          fontSize: "15px",
          fontWeight: 600,
          textTransform: "none",
          boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)",
          "&:hover": { backgroundColor: "#1d4ed8" }
        }}
      >
        Compose
      </Button>

      <Box sx={{ mt: 2.5, flex: 1, overflowY: "auto" }}>
        {/* Mailboxes: used constantly, always on top */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <NavItem
            to={`${routes.email.path}/All`}
            label="Inbox"
            icon={<InboxOutlinedIcon />}
            count={getUnreadCount("All")}
            active={activeName === "all"}
            onClick={() => categoryHook.setCategory("All")}
          />
          <NavItem
            to={`${routes.email.path}/Starred`}
            label="Starred"
            icon={<StarBorderRoundedIcon />}
            active={activeName === "starred"}
            onClick={() => categoryHook.setCategory("Starred")}
          />
          <NavItem
            to={`${routes.email.path}/Sent`}
            label="Sent"
            icon={<SendOutlinedIcon />}
            active={activeName === "sent"}
            onClick={() => categoryHook.setCategory("Sent")}
          />
          <NavItem
            to={`${routes.email.path}/Drafts`}
            label="Drafts"
            icon={<EditNoteOutlinedIcon />}
            active={activeName === "drafts"}
            onClick={() => categoryHook.setCategory("Drafts")}
          />
        </Box>

        {/* AI categories: pinned / most-used first, the rest fold away */}
        <SectionHeader
          action={
            <Tooltip title="Add or edit categories">
              <IconButton size="small" onClick={handlePopupOpen} sx={{ p: 0.25, color: "#94a3b8", "&:hover": { color: "#2563eb" } }}>
                <AddIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          }
        >
          My categories
        </SectionHeader>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          {visible.map(categoryItem)}
        </Box>

        {folded.length > 0 && (
          <>
            <Box
              onClick={() => updatePrefs({ moreOpen: !moreOpen })}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                px: 1.5,
                py: 0.75,
                cursor: "pointer",
                userSelect: "none",
                color: "#64748b",
                borderRadius: 2,
                "&:hover": { backgroundColor: "#f8fafc" }
              }}
            >
              {moreOpen ? <ExpandMoreIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
              <Typography sx={{ fontSize: "13px", fontWeight: 500 }}>
                {moreOpen ? "Show less" : `${folded.length} more`}
              </Typography>
            </Box>
            <Collapse in={moreOpen} unmountOnExit>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                {folded.map(categoryItem)}
              </Box>
            </Collapse>
          </>
        )}

        {/* Gmail-sorted noise: grouped, muted, collapsed by default */}
        <SectionHeader
          onClick={() => updatePrefs({ filteredOpen: !prefs.filteredOpen })}
          open={filteredOpen}
          badge={filteredTotal}
        >
          Filtered
        </SectionHeader>
        <Collapse in={filteredOpen} unmountOnExit>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {FILTERED.map((name) => (
              <NavItem
                key={name}
                to={`${routes.email.path}/${name}`}
                label={name}
                color={getRandomColor(name)}
                count={getUnreadCount(name)}
                active={activeName === name.toLowerCase()}
                muted
                onClick={() => openCategory(name)}
              />
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* Customize Categories Trigger */}
      <Button
        variant="outlined"
        onClick={handlePopupOpen}
        startIcon={<TuneIcon />}
        fullWidth
        sx={{
          mt: 2,
          borderColor: "#e2e8f0",
          color: "#475569",
          borderRadius: 2,
          py: 1,
          fontSize: "13px",
          fontWeight: 600,
          textTransform: "none",
          "&:hover": { borderColor: "#cbd5e1", backgroundColor: "#f8fafc" }
        }}
      >
        Manage Categories
      </Button>

      {/* Customize Dialog */}
      <Dialog
        open={openPopup}
        onClose={handlePopupClose}
        PaperProps={{
          sx: {
            backgroundColor: "#ffffff",
            borderRadius: 3,
            border: "1px solid #e2e8f0",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
            fontFamily: "'Inter', sans-serif"
          },
        }}
      >
        <DialogContent sx={{ p: 3 }}>
          <NewCategory />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handlePopupClose}
            variant="outlined"
            sx={{
              color: "#64748b",
              borderColor: "#cbd5e1",
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 2,
              "&:hover": { borderColor: "#94a3b8", backgroundColor: "#f8fafc" }
            }}
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{
              backgroundColor: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              textTransform: "none",
              borderRadius: 2,
              boxShadow: "none",
              "&:hover": { backgroundColor: "#1d4ed8" },
            }}
          >
            Apply & Refresh
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compose Window */}
      <Compose openDialog={openDialog} setOpenDialog={setOpenDialog} />
    </Box>
  );
};

export default SideBarContent;
