import React, { useState, useContext, useEffect, useMemo } from "react";
import {
  Box,
  List,
  ListItem,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography
} from "@mui/material";
import { CreateOutlined } from "@mui/icons-material";
import TuneIcon from '@mui/icons-material/Tune';
import NewCategory from "./NewCategory";
import Compose from "./Compose";
import { useParams, NavLink } from "react-router-dom";
import { routes } from "../routes/route";
import { emailContext } from "../App";
import { getRandomColor } from "../content/getColor";
import { motion } from "framer-motion";
import { Refresh } from "./Refresh";
import axios from "axios";

const getQueryParam = (param) => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
};

const SYSTEM_CATEGORIES = ["Promotions", "Social", "Spam"];

const SideBarContent = () => {
  const categoryHook = useContext(emailContext);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPopup, setOpenPopup] = useState(false);
  const { type } = useParams();
  const activeUserId = categoryHook.selectedUser || localStorage.getItem("mailwise_user_id");

  const getCategoryCount = (categoryName) => {
    if (!categoryHook.emails || categoryHook.emails.length === 0) return 0;
    if (categoryName === "All") return categoryHook.emails.length;
    return categoryHook.emails.filter(
      (email) => email.category?.toLowerCase() === categoryName?.toLowerCase()
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
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${activeUserId}`
        );
        categoryHook.setCategories([
          { name: "All", title: "All Emails" },
          ...response.data,
        ]);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    if (activeUserId) fetchCategories();
  }, [activeUserId]);

  // Separate focus categories from system buckets
  const { focusCategories, systemBuckets } = useMemo(() => {
    const cats = categoryHook.categories || [{ name: "All" }];
    const focus = [];
    const system = [];

    cats.forEach(c => {
      if (SYSTEM_CATEGORIES.some(sc => sc.toLowerCase() === c.name.toLowerCase())) {
        system.push(c);
      } else {
        focus.push(c);
      }
    });

    // Ensure standard system buckets exist if not already in category list
    SYSTEM_CATEGORIES.forEach(sc => {
      if (!system.some(s => s.name.toLowerCase() === sc.toLowerCase())) {
        system.push({ name: sc });
      }
    });

    return { focusCategories: focus, systemBuckets: system };
  }, [categoryHook.categories]);

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
          "&:hover": {
            backgroundColor: "#1d4ed8"
          }
        }}
      >
        Compose
      </Button>

      {/* Main Focus Categories */}
      <Box sx={{ mt: 3, flex: 1, overflowY: "auto" }}>
        <Typography
          sx={{
            px: 1.5,
            mb: 1,
            fontSize: "11px",
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.6
          }}
        >
          Inbox & Categories
        </Typography>

        <List sx={{ p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {focusCategories.map((data) => {
            const isActive = (type?.toLowerCase() === data.name.toLowerCase()) || (!type && data.name === "All");
            const count = getCategoryCount(data.name);

            return (
              <NavLink
                key={data.name}
                to={`${routes.email.path}/${data.name}`}
                onClick={() => categoryHook.setCategory(data.name)}
                style={{ textDecoration: "none" }}
              >
                <ListItem
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    cursor: "pointer",
                    backgroundColor: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#2563eb" : "#334155",
                    fontWeight: isActive ? 600 : 500,
                    transition: "all 0.15s ease",
                    "&:hover": {
                      backgroundColor: isActive ? "#eff6ff" : "#f8fafc"
                    }
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: getRandomColor(data.name)
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontWeight: isActive ? 600 : 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {data.name}
                    </Typography>
                  </Box>

                  {count > 0 && (
                    <Typography
                      sx={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: isActive ? "#2563eb" : "#94a3b8"
                      }}
                    >
                      {count}
                    </Typography>
                  )}
                </ListItem>
              </NavLink>
            );
          })}
        </List>

        {/* System Buckets */}
        <Typography
          sx={{
            px: 1.5,
            mt: 3,
            mb: 1,
            fontSize: "11px",
            fontWeight: 700,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: 0.6
          }}
        >
          System Folders
        </Typography>

        <List sx={{ p: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {systemBuckets.map((data) => {
            const isActive = type?.toLowerCase() === data.name.toLowerCase();
            const count = getCategoryCount(data.name);

            return (
              <NavLink
                key={data.name}
                to={`${routes.email.path}/${data.name}`}
                onClick={() => categoryHook.setCategory(data.name)}
                style={{ textDecoration: "none" }}
              >
                <ListItem
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    cursor: "pointer",
                    backgroundColor: isActive ? "#eff6ff" : "transparent",
                    color: isActive ? "#2563eb" : "#64748b",
                    fontWeight: isActive ? 600 : 500,
                    transition: "all 0.15s ease",
                    "&:hover": {
                      backgroundColor: isActive ? "#eff6ff" : "#f8fafc"
                    }
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: getRandomColor(data.name)
                      }}
                    />
                    <Typography sx={{ fontSize: "14px", fontWeight: isActive ? 600 : 500 }}>
                      {data.name}
                    </Typography>
                  </Box>

                  {count > 0 && (
                    <Typography sx={{ fontSize: "12px", fontWeight: 600, color: isActive ? "#2563eb" : "#94a3b8" }}>
                      {count}
                    </Typography>
                  )}
                </ListItem>
              </NavLink>
            );
          })}
        </List>
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
          "&:hover": {
            borderColor: "#cbd5e1",
            backgroundColor: "#f8fafc"
          }
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
              "&:hover": {
                borderColor: "#94a3b8",
                backgroundColor: "#f8fafc",
              }
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
              "&:hover": {
                backgroundColor: "#1d4ed8",
              },
            }}
          >
            Apply & Refresh
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compose Dialog */}
      <Compose openDialog={openDialog} setOpenDialog={setOpenDialog} />
    </Box>
  );
};

export default SideBarContent;
