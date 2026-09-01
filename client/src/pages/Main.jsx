import React, { Suspense, useState } from "react";
import { Outlet } from "react-router-dom";
import { Box } from "@mui/material";
import Header from "../components/Header";
import SideBar from "../components/SideBar";
import SuspenseLoader from "../components/error/SuspenseLoader";

const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 270;
const COLLAPSED_SIDEBAR_WIDTH = 0;

const Main = () => {
  const [openDrawer, setOpenDrawer] = useState(true);

  const toggleDrawer = () => {
    setOpenDrawer((prev) => !prev);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "#f8fafc"
      }}
    >
      {/* Top Header */}
      <Box sx={{ height: `${HEADER_HEIGHT}px`, flexShrink: 0, zIndex: 100 }}>
        <Header toggleDrawer={toggleDrawer} />
      </Box>

      {/* Main Workspace Area (Sidebar + Scrollable Content) */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          overflow: "hidden",
          position: "relative"
        }}
      >
        {/* Left Sidebar */}
        <SideBar openDrawer={openDrawer} />

        {/* Scrollable Content Container */}
        <Box
          component="main"
          sx={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            marginLeft: openDrawer ? `${SIDEBAR_WIDTH}px` : `${COLLAPSED_SIDEBAR_WIDTH}px`,
            transition: "margin-left 0.25s ease-in-out",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box"
          }}
        >
          <Suspense fallback={<SuspenseLoader />}>
            <Outlet context={{ openDrawer }} />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default Main;
