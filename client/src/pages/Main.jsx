import React, { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Box, useMediaQuery } from "@mui/material";
import Header from "../components/Header";
import SideBar, { SIDEBAR_WIDTH } from "../components/SideBar";
import SuspenseLoader from "../components/error/SuspenseLoader";

const HEADER_HEIGHT = 64;

const Main = () => {
  const isMobile = useMediaQuery("(max-width:899px)");
  const [openDrawer, setOpenDrawer] = useState(() => !window.matchMedia("(max-width:899px)").matches);
  const location = useLocation();

  // Crossing the breakpoint: open on desktop, closed on mobile
  useEffect(() => {
    setOpenDrawer(!isMobile);
  }, [isMobile]);

  // On mobile the drawer is an overlay: close it once the user navigates
  useEffect(() => {
    if (isMobile) setOpenDrawer(false);
  }, [location.pathname, isMobile]);

  const toggleDrawer = () => setOpenDrawer((prev) => !prev);

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

      {/* Sidebar + scrollable content */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          overflow: "hidden",
          position: "relative"
        }}
      >
        <SideBar openDrawer={openDrawer} onClose={() => setOpenDrawer(false)} isMobile={isMobile} />

        <Box
          component="main"
          sx={{
            flex: 1,
            height: "100%",
            overflowY: "auto",
            overflowX: "hidden",
            marginLeft: !isMobile && openDrawer ? `${SIDEBAR_WIDTH}px` : 0,
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
