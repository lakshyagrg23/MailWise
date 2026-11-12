import React from "react";
import { Button, Dialog, DialogActions, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import NewCategory from "../../categories/NewCategory";

/** "Manage categories" dialog. Edits are saved as they happen; Done just closes and lets the caller refresh. */
const CategoriesDialog = ({ open, onClose, onDone }) => (
  <Dialog
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        backgroundColor: "#ffffff",
        borderRadius: 4,
        border: "1px solid #e2e8f0",
        boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
        fontFamily: "'Inter', sans-serif",
        width: "100%",
        maxWidth: 600,
        m: { xs: 1.5, sm: 4 }
      },
    }}
  >
    <IconButton
      onClick={onClose}
      aria-label="Close"
      size="small"
      sx={{ position: "absolute", top: 14, right: 14, color: "#94a3b8", "&:hover": { color: "#0f172a", backgroundColor: "#f1f5f9" } }}
    >
      <CloseIcon fontSize="small" />
    </IconButton>
    <DialogContent sx={{ p: { xs: 2.5, sm: 3.5 }, pb: 1 }}>
      <NewCategory />
    </DialogContent>

    <DialogActions sx={{ px: { xs: 2.5, sm: 3.5 }, py: 2, borderTop: "1px solid #f1f5f9" }}>
      <Button
        onClick={onDone}
        variant="contained"
        disableElevation
        sx={{
          backgroundColor: "#2563eb",
          color: "#fff",
          fontWeight: 600,
          textTransform: "none",
          borderRadius: 2,
          px: 3,
          "&:hover": { backgroundColor: "#1d4ed8" },
        }}
      >
        Done
      </Button>
    </DialogActions>
  </Dialog>
);

export default CategoriesDialog;
