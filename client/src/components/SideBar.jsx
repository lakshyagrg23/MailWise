import React from "react";
import { Drawer } from "@mui/material";
import SideBarContent from "./SideBarContent";

export const SIDEBAR_WIDTH = 270;
const HEADER_HEIGHT = 64;

// Desktop: persistent rail under the header. Mobile: slide-over drawer with a backdrop.
const SideBar = ({ openDrawer, onClose, isMobile }) => {
  return (
    <Drawer
      anchor="left"
      open={openDrawer}
      onClose={onClose}
      variant={isMobile ? "temporary" : "persistent"}
      ModalProps={{ keepMounted: true }}
      sx={{
        "& .MuiDrawer-paper": {
          width: SIDEBAR_WIDTH,
          maxWidth: "85vw",
          marginTop: isMobile ? 0 : `${HEADER_HEIGHT}px`,
          height: isMobile ? "100%" : `calc(100vh - ${HEADER_HEIGHT}px)`,
          borderRight: "1px solid #e2e8f0",
          overflowX: "hidden",
          backgroundColor: "#ffffff",
          boxShadow: isMobile ? "0 0 40px rgba(15, 23, 42, 0.25)" : "none",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        },
      }}
    >
      <SideBarContent />
    </Drawer>
  );
};

export default SideBar;
