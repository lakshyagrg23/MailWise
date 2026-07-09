import {
  Box,
  List,
  ListItem,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Badge,
  Typography,
} from "@mui/material";
import { CreateOutlined } from "@mui/icons-material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import React, { useState, useContext, useEffect } from "react";
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

const SideBarContent = () => {
  const categoryHook = useContext(emailContext);
  const [openDialog, setOpenDialog] = useState(false);
  const [openPopup, setOpenPopup] = useState(false);
  const { type } = useParams();
  const userId = getQueryParam("user_id");

  const getCategoryCount = (categoryName) => {
    if (!categoryHook.emails || categoryHook.emails.length === 0) return 0;
    if (categoryName === "All") return categoryHook.emails.length;
    return categoryHook.emails.filter(
      (email) => email.category === categoryName
    ).length;
  };

  const onComposeClick = () => setOpenDialog(true);
  const handlePopupOpen = () => setOpenPopup(true);
  const handlePopupClose = () => setOpenPopup(false);

  const handleSave=async()=>{
    Refresh()   
    handlePopupClose()
  }

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}`
        );
        categoryHook.setCategories([
          { name: "All", title: "All Emails" },
          ...response.data,
        ]);
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    if (userId) fetchCategories();
  }, [userId]);

  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="flex flex-col h-full px-4 py-5"
      style={{
        fontFamily: "'DM Sans', sans-serif",
        backgroundColor: "#fefefe",
        borderRadius: "16px 0 0 16px",
        boxShadow:
          "0 10px 20px rgba(79, 70, 229, 0.15), 0 6px 6px rgba(16, 185, 129, 0.1)",
        color: "#111827",
      }}
    >
      {/* Compose Button */}
      <motion.button
        onClick={onComposeClick}
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 py-3 text-lg font-semibold flex items-center gap-3 transition-all duration-300 shadow-lg"
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.95 }}
        style={{
          boxShadow: "0 4px 12px rgba(79, 70, 229, 0.5)",
        }}
      >
        <CreateOutlined className="text-white" />
        Compose
      </motion.button>

      {/* Categories List */}
      <List className="mt-8 space-y-2">
        {categoryHook.categories?.map((data, index) => {
          const isActive = type === data.name.toLowerCase();
          const count = getCategoryCount(data.name);

          return (
            <NavLink
              key={data.name}
              to={`${routes.email.path}/${data.name}`}
              onClick={() => categoryHook.setCategory(data.name)}
              className="block no-underline"
            >
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, duration: 0.35 }}
              >
                <ListItem
                  className={`flex items-center justify-between px-5 py-3 rounded-xl cursor-pointer transition-all duration-300 ${
                    isActive
                      ? "bg-purple-500 shadow-lg text-white scale-[1.04]"
                      : "hover:bg-purple-100"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Color Dot */}
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{
                        backgroundColor: getRandomColor(data.name),
                        boxShadow: `0 0 8px ${getRandomColor(data.name)}88`,
                      }}
                    />
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: "700", color: isActive ? "#fff" : "#374151" }}
                    >
                      {data.name}
                    </Typography>
                  </div>

                </ListItem>
              </motion.div>
            </NavLink>
          );
        })}
      </List>

      {/* Customize Categories Button */}
      <motion.button
        onClick={handlePopupOpen}
        className="mt-auto bg-gradient-to-r from-blue-700 to-green-500 text-white rounded-xl px-5 py-3 text-sm font-semibold flex items-center justify-center gap-2 shadow-md transition-transform duration-300 hover:scale-105"
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.95 }}
        style={{
          boxShadow: "0 6px 15px rgba(245, 158, 11, 0.5)",
        }}
      >
        <AddCircleIcon fontSize="small" />
        Customize Categories
      </motion.button>

      {/* Customize Dialog */}
      <Dialog
        open={openPopup}
        onClose={handlePopupClose}
        PaperProps={{
          sx: {
            backgroundColor: "#fefefe",
            borderRadius: 3,
            boxShadow:
              "0 10px 30px rgba(79, 70, 229, 0.25), 0 10px 20px rgba(245, 158, 11, 0.15)",
            fontFamily: "'DM Sans', sans-serif",
            color: "#111827",
          },
        }}
      >
        <DialogContent>
          <NewCategory />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handlePopupClose}
            variant="outlined"
            sx={{
              color: "#4f46e5",
              borderColor: "#4f46e5",
              "&:hover": {
                backgroundColor: "rgba(79, 70, 229, 0.1)",
                borderColor: "#4f46e5",
              },
              fontWeight: "600",
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            sx={{
              background: "blue-700",
              color: "#fff",
              boxShadow: "0 0 15px rgba(245, 158, 11, 0.6)",
              fontWeight: "700",
              "&:hover": {
                background: "blue-700",
              },
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Compose Dialog */}
      <Compose openDialog={openDialog} setOpenDialog={setOpenDialog} />
    </motion.div>
  );
};

export default SideBarContent;
