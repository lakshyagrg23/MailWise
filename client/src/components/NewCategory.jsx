import React, { useState, useContext, useMemo } from "react";
import http from "../api/http";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import { emailContext } from "../App";
import { getRandomColor } from "../content/getColor";

// Names that are built-in views/buckets, not user categories
const RESERVED = ["all", "inbox", "starred", "sent", "drafts", "promotions", "social", "spam"];
const MAX_NAME = 30;

const SUGGESTIONS = [
  { name: "Work", description: "Messages from colleagues, clients, meetings, and project updates" },
  { name: "Travel", description: "Flight, hotel, and trip bookings, itineraries, and boarding passes" },
  { name: "Receipts", description: "Order confirmations, invoices, and payment receipts" },
  { name: "Newsletters", description: "Regular newsletters, digests, and blog subscriptions" },
  { name: "Health", description: "Appointments, prescriptions, and medical or insurance messages" },
  { name: "Jobs", description: "Job alerts, applications, recruiter messages, and interviews" },
];

const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#ffffff", fontSize: "14px" } };

const NewCategory = () => {
  const { categories, setCategories, emails, update, setUpdate } = useContext(emailContext);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(null); // "create" | "edit" | "delete:<name>"
  const [error, setError] = useState("");

  const userCategories = useMemo(
    () => (categories || []).filter((c) => !RESERVED.includes(c.name?.toLowerCase())),
    [categories]
  );

  const emailCount = (name) =>
    (emails || []).filter((e) => e.category?.toLowerCase() === name.toLowerCase()).length;

  const trimmedName = categoryName.trim();
  const nameError = !trimmedName
    ? ""
    : trimmedName.length > MAX_NAME
      ? `Keep it under ${MAX_NAME} characters`
      : RESERVED.includes(trimmedName.toLowerCase())
        ? `"${trimmedName}" is a built-in folder`
        : (categories || []).some((c) => c.name?.toLowerCase() === trimmedName.toLowerCase())
          ? "A category with this name already exists"
          : "";
  const canCreate = !!trimmedName && !!description.trim() && !nameError && !busy;

  const nextUpdate = () => parseInt(update || 1) + 1;
  const bumpUpdate = () => setUpdate((prev) => parseInt(prev || 1) + 1);

  const resetAddForm = () => {
    setIsAdding(false);
    setCategoryName("");
    setDescription("");
  };

  const handleCreate = async (e) => {
    e?.preventDefault();
    if (!canCreate) return;
    setBusy("create");
    setError("");
    try {
      const response = await http.post("/categories", {
        newCategoryName: trimmedName,
        newDescription: description.trim(),
        update: nextUpdate(),
      });
      bumpUpdate();
      setCategories((prev) => [...prev, response.data]);
      resetAddForm();
    } catch (err) {
      setError(err.response?.data?.error || "Could not create the category. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleSaveEdit = async (name) => {
    if (!editedDescription.trim()) return;
    setBusy("edit");
    setError("");
    try {
      const response = await http.put(`/categories/${encodeURIComponent(name)}`, {
        newCategoryName: name,
        newDescription: editedDescription.trim(),
        update: nextUpdate(),
      });
      if (response.status === 200) {
        const text = editedDescription.trim();
        setCategories((prev) =>
          prev.map((c) => (c.name === name ? { ...c, description: text, title: text } : c))
        );
        bumpUpdate();
        setEditingCategory(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Could not save the description. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (name) => {
    setBusy(`delete:${name}`);
    setError("");
    try {
      await http.delete(`/categories/${encodeURIComponent(name)}`, {
        data: { update: nextUpdate() },
      });
      bumpUpdate();
      setCategories((prev) => prev.filter((c) => c.name !== name));
      setConfirmDelete(null);
    } catch (err) {
      setError(err.response?.data?.error || "Could not delete the category. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const availableSuggestions = SUGGESTIONS.filter(
    (s) => !(categories || []).some((c) => c.name?.toLowerCase() === s.name.toLowerCase())
  );

  return (
    <Box sx={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Title */}
      <Box sx={{ mb: 2.5, pr: 4 }}>
        <Typography sx={{ fontSize: "20px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>
          Categories
        </Typography>
        <Typography sx={{ fontSize: "13.5px", color: "#64748b", mt: 0.5, lineHeight: 1.5 }}>
          Gemini sorts each new email into the category whose description fits best. Clear,
          specific descriptions work best.
        </Typography>
      </Box>

      {error && (
        <Box
          role="alert"
          sx={{ mb: 2, px: 1.75, py: 1.1, borderRadius: 2, fontSize: "13px", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca" }}
        >
          {error}
        </Box>
      )}

      {/* Add */}
      {!isAdding ? (
        <Button
          fullWidth
          startIcon={<AddIcon />}
          onClick={() => setIsAdding(true)}
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
      ) : (
        <Box
          component="form"
          onSubmit={handleCreate}
          sx={{ p: 2.5, mb: 2.5, backgroundColor: "#f8fafc", borderRadius: 3, border: "1px solid #e2e8f0" }}
        >
          <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#0f172a", mb: 1.5 }}>
            New category
          </Typography>

          {availableSuggestions.length > 0 && (
            <Box sx={{ mb: 1.75 }}>
              <Typography sx={{ fontSize: "12px", color: "#94a3b8", mb: 0.75 }}>Quick start</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {availableSuggestions.map((s) => (
                  <Chip
                    key={s.name}
                    size="small"
                    label={s.name}
                    icon={<AutoAwesomeIcon sx={{ fontSize: "14px !important" }} />}
                    onClick={() => {
                      setCategoryName(s.name);
                      setDescription(s.description);
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
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            error={!!nameError}
            helperText={nameError || " "}
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
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            sx={{ mb: 2, ...fieldSx }}
          />

          <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button size="small" onClick={resetAddForm} sx={{ textTransform: "none", color: "#64748b", fontWeight: 500 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              variant="contained"
              disableElevation
              disabled={!canCreate}
              startIcon={busy === "create" ? <CircularProgress size={14} sx={{ color: "inherit" }} /> : null}
              sx={{ backgroundColor: "#2563eb", textTransform: "none", fontWeight: 600, borderRadius: 2, px: 2, "&:hover": { backgroundColor: "#1d4ed8" } }}
            >
              {busy === "create" ? "Creating" : "Create"}
            </Button>
          </Box>
        </Box>
      )}

      {/* List */}
      <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, mb: 1 }}>
        Your categories{userCategories.length ? ` · ${userCategories.length}` : ""}
      </Typography>

      <Box sx={{ maxHeight: { xs: "40vh", sm: "320px" }, overflowY: "auto", pr: 0.5, scrollbarWidth: "thin" }}>
        {userCategories.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {userCategories.map((category) => {
              const isEditing = editingCategory === category.name;
              const isConfirming = confirmDelete === category.name;
              const count = emailCount(category.name);
              const desc = category.description || category.title || "No description yet.";
              const color = getRandomColor(category.name);

              return (
                <Box
                  key={category.name}
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
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
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
                                  disabled={!!busy || !editedDescription.trim()}
                                  onClick={() => handleSaveEdit(category.name)}
                                  sx={{ color: "#16a34a", "&:hover": { backgroundColor: "#f0fdf4" } }}
                                >
                                  {busy === "edit" ? <CircularProgress size={16} /> : <CheckIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton size="small" onClick={() => setEditingCategory(null)} sx={{ color: "#64748b" }}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <>
                            <Tooltip title="Edit description">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingCategory(category.name);
                                  setEditedDescription(category.description || category.title || "");
                                }}
                                sx={{ color: "#94a3b8", "&:hover": { color: "#2563eb", backgroundColor: "#eff6ff" } }}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => setConfirmDelete(category.name)}
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
                        <Button size="small" onClick={() => setConfirmDelete(null)} sx={{ textTransform: "none", color: "#64748b" }}>
                          Keep
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          disableElevation
                          disabled={!!busy}
                          onClick={() => handleDelete(category.name)}
                          sx={{ textTransform: "none", fontWeight: 600, borderRadius: 1.5 }}
                        >
                          {busy === `delete:${category.name}` ? "Deleting" : "Delete"}
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <LabelOutlinedIcon sx={{ fontSize: 34, color: "#cbd5e1", mb: 0.5 }} />
            <Typography sx={{ fontSize: "14px", fontWeight: 600, color: "#475569" }}>No custom categories yet</Typography>
            <Typography sx={{ fontSize: "13px", color: "#94a3b8", mt: 0.25 }}>
              Create one above and new mail will start sorting into it.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default NewCategory;
