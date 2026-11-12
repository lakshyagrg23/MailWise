import React from "react";
import { NavLink } from "react-router-dom";
import { Box, Typography, Tooltip, IconButton } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import PushPinIcon from "@mui/icons-material/PushPin";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";

/**
 * One sidebar row (mailbox or category). `icon` renders an icon, otherwise a coloured dot using
 * `color`. `dnd` (from useCategoryReorder) makes the row draggable; `onTogglePin` shows the pin.
 */
const NavItem = ({
  to, label, color, icon, count, active, muted, onClick, pinned, onTogglePin, dnd
}) => (
  <NavLink
    to={to}
    onClick={onClick}
    style={{ textDecoration: "none" }}
    draggable={!!dnd}
    onDragStart={dnd?.onDragStart}
    onDragOver={dnd?.onDragOver}
    onDrop={dnd?.onDrop}
    onDragEnd={dnd?.onDragEnd}
    onKeyDown={dnd?.onKeyDown}
    title={dnd ? "Drag to reorder (or Alt + ↑/↓)" : undefined}
  >
    <Box
      sx={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.5,
        py: 0.9,
        borderRadius: 2,
        cursor: dnd ? "grab" : "pointer",
        opacity: dnd?.dragging ? 0.4 : 1,
        backgroundColor: active ? "#eff6ff" : "transparent",
        color: active ? "#2563eb" : muted ? "#64748b" : "#334155",
        transition: "background-color 0.15s ease, opacity 0.15s ease",
        // Drop indicator: a blue line above/below the hovered target
        boxShadow:
          dnd?.dropPos === "before"
            ? "inset 0 2px 0 #2563eb"
            : dnd?.dropPos === "after"
              ? "inset 0 -2px 0 #2563eb"
              : "none",
        "&:hover": { backgroundColor: active ? "#eff6ff" : "#f8fafc" },
        "&:hover .pin-btn": { opacity: 1 },
        "&:hover .grip": { opacity: 1 }
      }}
    >
      {dnd && (
        <DragIndicatorIcon
          className="grip"
          sx={{ position: "absolute", left: -2, fontSize: 16, color: "#cbd5e1", opacity: 0, transition: "opacity 0.15s ease" }}
        />
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
        {icon ? (
          React.cloneElement(icon, { sx: { fontSize: 19, color: active ? "#2563eb" : "#64748b" } })
        ) : (
          <Box sx={{ width: 8, height: 8, ml: "5.5px", mr: "5.5px", borderRadius: "50%", flexShrink: 0, backgroundColor: color }} />
        )}
        <Typography
          noWrap
          sx={{ fontSize: "14px", fontWeight: active ? 600 : 500, color: "inherit" }}
        >
          {label}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        {onTogglePin && (
          <Tooltip title={pinned ? "Unpin" : "Pin to top"}>
            <IconButton
              className="pin-btn"
              size="small"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin();
              }}
              sx={{
                p: 0.25,
                opacity: pinned ? 1 : 0,
                color: pinned ? "#2563eb" : "#94a3b8",
                transition: "opacity 0.15s ease"
              }}
            >
              {pinned ? <PushPinIcon sx={{ fontSize: 15 }} /> : <PushPinOutlinedIcon sx={{ fontSize: 15 }} />}
            </IconButton>
          </Tooltip>
        )}
        {count > 0 && (
          <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>
            {count}
          </Typography>
        )}
      </Box>
    </Box>
  </NavLink>
);

export default NavItem;
