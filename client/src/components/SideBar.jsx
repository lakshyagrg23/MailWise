import React from "react";
import { Drawer } from "@mui/material";
import SideBarContent from "./SideBarContent";

const SIDEBAR_WIDTH = 270;

const SideBar = ({ openDrawer, setSelectedCategory }) => {
  return (
    <Drawer
      anchor="left"
      open={openDrawer}
      hideBackdrop={true}
      ModalProps={{ keepMounted: true }}
      variant="persistent"
      sx={{
        "& .MuiDrawer-paper": {
          width: SIDEBAR_WIDTH,
          transition: "transform 0.25s ease-in-out, width 0.25s ease-in-out",
          borderRight: "1px solid #e2e8f0",
          marginTop: "64px",
          height: "calc(100vh - 64px)",
          overflowX: "hidden",
          backgroundColor: "#ffffff",
          boxShadow: "none",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          paddingTop: "12px",
          boxSizing: "border-box"
        },
      }}
    >
      <SideBarContent openDrawer={openDrawer} setSelectedCategory={setSelectedCategory} />
    </Drawer>
  );
};

export default SideBar;
