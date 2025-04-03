import React from "react";
import { Drawer } from "@mui/material";
import SideBarContent from "./SideBarContent";

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
          width: openDrawer ? 250 : 80, // Dynamically adjust width
          transition: "width 0.3s ease-in-out",
          borderRight: "none",
          background: "#f5f5f5",
          marginTop: "64px",
          height: "calc(100vh - 64px)",
          overflowX: "hidden", // Prevents white space issue
        },
      }}
    >
      <SideBarContent openDrawer={openDrawer} setSelectedCategory={setSelectedCategory} />
    </Drawer>
  );
};

export default SideBar;
