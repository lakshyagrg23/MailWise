import React from "react";
import { Box, Button, CircularProgress, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { getRandomColor } from "../../utils/getColor";
import { fieldSx } from "./constants";

/** One category card: name, email count, description, with inline edit and delete confirmation. */
const CategoryListItem = ({ category, count, row, busy }) => {
  const isEditing = row.editing === category.name;
  const isConfirming = row.confirming === category.name;
  const desc = category.description || category.title || "No description yet.";
  const color = getRandomColor(category.name);

  return (
    <Box
      sx={{
        p: 1.75,
        borderRadius: 2.5,
        border: "1px solid #e2e8f0",
        borderLeft: `3px solid ${color}`,
        backgroundColor: "#ffffff",
        transition: "box-shadow 0.15s ease, border-color 0.15s ease",
        "&:hover": { boxShadow: "0 2px 10px rgba(15, 23, 42, 0.06)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.4 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "14.5px", color: "#0f172a" }}>
              {category.name}
            </Typography>
            <Typography sx={{ fontSize: "12px", color: "#94a3b8" }}>
              {count} {count === 1 ? "email" : "emails"}
            </Typography>
          </Box>

          {isEditing ? (
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              autoFocus
              value={row.editedDescription}
              onChange={(e) => row.setEditedDescription(e.target.value)}
              sx={{ mt: 0.75, ...fieldSx }}
            />
          ) : (
            <Typography sx={{ fontSize: "13px", color: "#64748b", lineHeight: 1.45 }}>{desc}</Typography>
          )}
        </Box>

        {!isConfirming && (
          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {isEditing ? (
              <>
                <Tooltip title="Save">
                  <span>
                    <IconButton
                      size="small"
                      disabled={!!busy || !row.editedDescription.trim()}
                      onClick={() => row.saveEdit(category.name)}
                      sx={{ color: "#16a34a", "&:hover": { backgroundColor: "#f0fdf4" } }}
                    >
                      {busy === "edit" ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton size="small" onClick={row.cancelEdit} sx={{ color: "#64748b" }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip title="Edit description">
                  <IconButton
                    size="small"
                    onClick={() => row.startEdit(category)}
                    sx={{ color: "#94a3b8", "&:hover": { color: "#2563eb", backgroundColor: "#eff6ff" } }}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => row.askDelete(category.name)}
                    sx={{ color: "#94a3b8", "&:hover": { color: "#dc2626", backgroundColor: "#fef2f2" } }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        )}
      </Box>

      {isConfirming && (
        <Box
          sx={{
            mt: 1.25,
            p: 1.25,
            borderRadius: 2,
            backgroundColor: "#fef2f2",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            flexWrap: "wrap",
          }}
        >
          <Typography sx={{ fontSize: "12.5px", color: "#991b1b", flex: 1, minWidth: 180 }}>
            Delete “{category.name}”? Emails already sorted into it keep this label.
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Button size="small" onClick={row.cancelDelete} sx={{ textTransform: "none", color: "#64748b" }}>
              Keep
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              disableElevation
              disabled={!!busy}
              onClick={() => row.confirmDelete(category.name)}
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 1.5 }}
            >
              {busy === `delete:${category.name}` ? "Deleting" : "Delete"}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CategoryListItem;
