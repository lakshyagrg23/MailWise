import React, { Suspense, useState,useContext } from "react";
import { Outlet } from "react-router-dom";
import { Box, styled } from "@mui/material";
import Header from "../components/Header";
import SideBar from "../components/SideBar";
import SuspenseLoader from "../components/error/SuspenseLoader";

const SIDEBAR_WIDTH = 250;
const COLLAPSED_SIDEBAR_WIDTH = 0; // Keeps a small sidebar when collapsed
const HEADER_HEIGHT = 64;

const LayoutContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

// Fixed Header at the top
const FixedHeader = styled(Box)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: ${HEADER_HEIGHT}px;
  background: white;
  z-index: 1000;
  box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
`;

// Sidebar Styling
const SidebarContainer = styled(Box)`
  position: fixed;
  top: ${HEADER_HEIGHT}px;
  left: 0;
  margin-top:64px;
  height: 100vh ;
  width: ${(props) => (props.openDrawer ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH)}px;
  transition: width 0.3s ease-in-out;
  background: #f5f5f5;
  box-shadow: ${(props) => (props.openDrawer ? "2px 0px 10px rgba(0, 0, 0, 0.1)" : "none")};
  overflow-x: hidden;
`;

// Main content area
const ContentContainer = styled(Box)(({ openDrawer }) => ({
  display: "flex",
  flexGrow: 1,
  flexDirection: "column",
  marginTop: "65px",
  transition: "margin-left 0.3s ease-in-out",
  marginLeft: `${openDrawer ? SIDEBAR_WIDTH : COLLAPSED_SIDEBAR_WIDTH}px-2px`,
}));

// Email Wrapper - Ensures proper alignment
const EmailWrapper = styled(Box)`
  flex-grow: 1;
  width: 100vw;
  height:100vh;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  overflow-y: auto;
  padding: 16px;
`;

const Main = () => {
  const [openDrawer, setOpenDrawer] = useState(true);

  const toggleDrawer = () => {
    setOpenDrawer((prev) => !prev);
  };

  return (
    <LayoutContainer>
      {/* Header */}
      <FixedHeader>
        <Header toggleDrawer={toggleDrawer} />
      </FixedHeader>

      {/* Sidebar */}
      <SidebarContainer openDrawer={openDrawer}>
        <SideBar openDrawer={openDrawer}  />
      </SidebarContainer>

      {/* Main Content */}
      <Suspense fallback={<SuspenseLoader />}>
        <ContentContainer openDrawer={openDrawer}>
          <EmailWrapper>
            <Outlet context={{ openDrawer }} />
          </EmailWrapper>
        </ContentContainer>
      </Suspense>
    </LayoutContainer>
  );
};

export default Main;
