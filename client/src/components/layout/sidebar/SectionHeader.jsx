import React from "react";
import { Box, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

const sectionLabelSx = {
  fontSize: "11px",
  fontWeight: 700,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.6
};

/** Sidebar group title. With `onClick` it is a collapsible header showing a chevron and `badge`. */
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

export default SectionHeader;
