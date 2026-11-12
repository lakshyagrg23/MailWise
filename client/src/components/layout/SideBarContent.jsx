import React, { useState, useContext, useEffect } from "react";
import { Box, Button, Collapse, IconButton, Tooltip, Typography } from "@mui/material";
import { CreateOutlined } from "@mui/icons-material";
import TuneIcon from "@mui/icons-material/Tune";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Compose from "../compose/Compose";
import { routes } from "../../routes/route";
import { emailContext } from "../../context/emailContext";
import { getRandomColor } from "../../utils/getColor";
import { listCategories } from "../../api/categories";
import NavItem from "./sidebar/NavItem";
import SectionHeader from "./sidebar/SectionHeader";
import MailboxList from "./sidebar/MailboxList";
import CategoriesDialog from "./sidebar/CategoriesDialog";
import { FILTERED } from "./sidebar/constants";
import { countUnread } from "./sidebar/mailCounts";
import { useSidebarPrefs } from "./sidebar/useSidebarPrefs";
import { useCategoryRanking } from "./sidebar/useCategoryRanking";
import { useCategoryReorder } from "./sidebar/useCategoryReorder";

const SideBarContent = () => {
  const categoryHook = useContext(emailContext);
  // Compose open-state lives in context so a draft row can open it too
  const openDialog = categoryHook.composeOpen;
  const setOpenDialog = categoryHook.setComposeOpen;
  const [openPopup, setOpenPopup] = useState(false);
  const [prefs, updatePrefs] = useSidebarPrefs();

  const activeName = (categoryHook.category || "All").toLowerCase();
  const getUnreadCount = (categoryName) => countUnread(categoryHook.emails, categoryName);

  const onComposeClick = () => setOpenDialog(true);
  const handlePopupOpen = () => setOpenPopup(true);
  const handlePopupClose = () => setOpenPopup(false);

  // Category edits are already saved server-side as they happen: just close and pull fresh mail
  const handleSave = () => {
    handlePopupClose();
    categoryHook.refreshMail();
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const fetched = await listCategories();
        categoryHook.setCategories([
          { name: "All", title: "All Emails" },
          ...fetched,
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

  const { visible, folded, ranked } = useCategoryRanking({
    categories: categoryHook.categories,
    emails: categoryHook.emails,
    prefs,
    activeName
  });
  const dndFor = useCategoryReorder({ ranked, prefs, updatePrefs });

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
      dnd={dndFor(name)}
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
          borderRadius: 3,
          py: 1.4,
          fontSize: "15px",
          fontWeight: 600,
          textTransform: "none",
          boxShadow: "0 6px 16px rgba(37, 99, 235, 0.28)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
          "&:hover": { backgroundColor: "#1d4ed8", transform: "translateY(-1px)", boxShadow: "0 8px 20px rgba(37, 99, 235, 0.34)" }
        }}
      >
        Compose
      </Button>

      <Box
        sx={{
          mt: 2.5,
          flex: 1,
          overflowY: "auto",
          mx: -1,
          px: 1,
          scrollbarWidth: "thin",
          scrollbarColor: "#e2e8f0 transparent",
          "&::-webkit-scrollbar": { width: 6 },
          "&::-webkit-scrollbar-thumb": { backgroundColor: "#e2e8f0", borderRadius: 3 }
        }}
      >
        {/* Mailboxes: used constantly, always on top */}
        <MailboxList
          activeName={activeName}
          inboxUnread={getUnreadCount("All")}
          onSelect={categoryHook.setCategory}
        />

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

        {prefs.order.length > 0 && (
          <Box
            onClick={() => updatePrefs({ order: [], usage: {} })}
            sx={{
              px: 1.5,
              py: 0.5,
              mt: 0.25,
              fontSize: "12px",
              color: "#94a3b8",
              cursor: "pointer",
              userSelect: "none",
              "&:hover": { color: "#2563eb" }
            }}
          >
            Reset to automatic order
          </Box>
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
        onClick={handlePopupOpen}
        startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
        fullWidth
        sx={{
          mt: 1.5,
          justifyContent: "flex-start",
          color: "#64748b",
          borderRadius: 2,
          px: 1.5,
          py: 1,
          fontSize: "13.5px",
          fontWeight: 500,
          textTransform: "none",
          borderTop: "1px solid #f1f5f9",
          "&:hover": { backgroundColor: "#f8fafc", color: "#2563eb" }
        }}
      >
        Manage categories
      </Button>

      <CategoriesDialog open={openPopup} onClose={handlePopupClose} onDone={handleSave} />

      {/* Compose Window */}
      <Compose openDialog={openDialog} setOpenDialog={setOpenDialog} />
    </Box>
  );
};

export default SideBarContent;
