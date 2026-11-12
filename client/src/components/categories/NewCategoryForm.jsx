import React from "react";
import { Box, Button, Chip, CircularProgress, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { MAX_NAME, fieldSx } from "./constants";

/** "New category" button that expands into the create form (with quick-start suggestions). */
const NewCategoryForm = ({ form }) => {
  if (!form.isAdding) {
    return (
      <Button
        fullWidth
        startIcon={<AddIcon />}
        onClick={form.startAdd}
        sx={{
          py: 1.2,
          mb: 2.5,
          color: "#2563eb",
          fontWeight: 600,
          textTransform: "none",
          borderRadius: 2.5,
          border: "1.5px dashed #bfdbfe",
          backgroundColor: "#f8fbff",
          "&:hover": { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
        }}
      >
        New category
      </Button>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={form.submit}
      sx={{ p: 2.5, mb: 2.5, backgroundColor: "#f8fafc", borderRadius: 3, border: "1px solid #e2e8f0" }}
    >
      <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", mb: 1.5 }}>
        New category
      </Typography>

      {form.suggestions.length > 0 && (
        <Box sx={{ mb: 1.75 }}>
          <Typography sx={{ fontSize: "12px", color: "#94a3b8", mb: 0.75 }}>Quick start</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {form.suggestions.map((s) => (
              <Chip
                key={s.name}
                size="small"
                label={s.name}
                icon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}
                onClick={() => {
                  form.setName(s.name);
                  form.setDescription(s.description);
                }}
                sx={{
                  fontWeight: 500,
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  "&:hover": { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      <TextField
        fullWidth
        size="small"
        autoFocus
        label="Name"
        placeholder="e.g. Work, Travel, Finance"
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        error={!!form.nameError}
        helperText={form.nameError || " "}
        inputProps={{ maxLength: MAX_NAME + 10 }}
        sx={{ mb: 0.5, ...fieldSx }}
      />

      <TextField
        fullWidth
        size="small"
        multiline
        minRows={2}
        label="What belongs here?"
        placeholder="e.g. Invoices, receipts, and bank statements"
        value={form.description}
        onChange={(e) => form.setDescription(e.target.value)}
        sx={{ mb: 2, ...fieldSx }}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button size="small" onClick={form.cancel} sx={{ textTransform: "none", color: "#64748b", fontWeight: 500 }}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="small"
          variant="contained"
          disableElevation
          disabled={!form.canCreate}
          startIcon={form.creating ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : null}
          sx={{ backgroundColor: "#2563eb", textTransform: "none", fontWeight: 600, borderRadius: 2, px: 2, "&:hover": { backgroundColor: "#1d4ed8" } }}
        >
          {form.creating ? "Creating" : "Create"}
        </Button>
      </Box>
    </Box>
  );
};

export default NewCategoryForm;
