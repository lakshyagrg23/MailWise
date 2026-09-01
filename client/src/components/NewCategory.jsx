import React, { useState, useContext } from "react";
import axios from "axios";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Divider,
  CircularProgress
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { emailContext } from "../App";
import { getRandomColor } from "../content/getColor";

const SYSTEM_PROTECTED = ["all", "promotions", "social", "spam"];

const NewCategory = () => {
  const { categories, setCategories, update, setUpdate, selectedUser } = useContext(emailContext);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const userId = selectedUser || localStorage.getItem("mailwise_user_id");

  const handleEditClick = (category) => {
    setEditingCategory(category.name);
    setEditedDescription(category.description || category.title || "");
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!categoryName.trim() || !description.trim() || !userId) return;

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}`, {
        newCategoryName: categoryName.trim(),
        newDescription: description.trim(),
        update: parseInt(update || 1) + 1
      });

      const newCategory = response.data;
      setUpdate(prev => parseInt(prev || 1) + 1);
      setCategories(prev => [...prev, newCategory]);
      setCategoryName("");
      setDescription("");
      setIsAdding(false);
    } catch (error) {
      console.error("Error creating category:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async (name) => {
    if (!userId || !editedDescription.trim()) return;

    setLoading(true);
    try {
      const response = await axios.put(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}/${name}`, {
        newCategoryName: name,
        newDescription: editedDescription.trim(),
        update: parseInt(update || 1) + 1
      });

      if (response.status === 200) {
        setCategories(prev =>
          prev.map(c => (c.name === name ? { ...c, description: editedDescription.trim(), title: editedDescription.trim() } : c))
        );
        setUpdate(prev => parseInt(prev || 1) + 1);
        setEditingCategory(null);
      }
    } catch (error) {
      console.error("Error updating category:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (name) => {
    if (!userId) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete the "${name}" category?`);
    if (!confirmDelete) return;

    setLoading(true);
    try {
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}/${name}`, {
        data: { update: parseInt(update || 1) + 1 }
      });
      setUpdate(prev => parseInt(prev || 1) + 1);
      setCategories(prev => prev.filter(c => c.name !== name));
    } catch (error) {
      console.error("Error deleting category:", error);
    } finally {
      setLoading(false);
    }
  };

  const userCustomCategories = (categories || []).filter(
    c => !SYSTEM_PROTECTED.includes(c.name?.toLowerCase())
  );

  return (
    <Box sx={{ minWidth: { xs: '100%', sm: '520px' }, maxWidth: '640px', fontFamily: "'Inter', sans-serif" }}>
      {/* Modal Title */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
          Manage Custom Categories
        </Typography>
        <Typography sx={{ fontSize: '13px', color: '#64748b' }}>
          Define custom tags and AI sorting descriptions for incoming emails.
        </Typography>
      </Box>

      {/* Add Category Section */}
      {!isAdding ? (
        <Button
          variant="outlined"
          fullWidth
          startIcon={<AddIcon />}
          onClick={() => setIsAdding(true)}
          sx={{
            py: 1.2,
            mb: 3,
            borderColor: '#cbd5e1',
            color: '#2563eb',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            borderStyle: 'dashed',
            '&:hover': {
              borderColor: '#2563eb',
              backgroundColor: '#f8fafc'
            }
          }}
        >
          Add New Category
        </Button>
      ) : (
        <Box
          component="form"
          onSubmit={handleCreateCategory}
          sx={{
            p: 2.5,
            mb: 3,
            backgroundColor: '#f8fafc',
            borderRadius: 2.5,
            border: '1px solid #e2e8f0'
          }}
        >
          <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', mb: 1.5 }}>
            Create New Category
          </Typography>

          <TextField
            fullWidth
            size="small"
            placeholder="Category Name (e.g. Work, Finance, Travel)"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            required
            sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#ffffff" } }}
          />

          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            placeholder="Description for Gemini classification (e.g. Invoices, receipts, and bank statements)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            sx={{ mb: 2, "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: "#ffffff" } }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button
              size="small"
              onClick={() => {
                setIsAdding(false);
                setCategoryName("");
                setDescription("");
              }}
              sx={{ textTransform: 'none', color: '#64748b', fontWeight: 500 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="small"
              variant="contained"
              disabled={loading || !categoryName.trim() || !description.trim()}
              sx={{
                backgroundColor: '#2563eb',
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 2,
                boxShadow: 'none',
                '&:hover': { backgroundColor: '#1d4ed8' }
              }}
            >
              {loading ? 'Creating...' : 'Save Category'}
            </Button>
          </Box>
        </Box>
      )}

      <Divider sx={{ mb: 2.5 }} />

      {/* Existing Categories List */}
      <Box sx={{ maxHeight: '340px', overflowY: 'auto', pr: 0.5 }}>
        {userCustomCategories.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {userCustomCategories.map((category) => {
              const isEditing = editingCategory === category.name;
              const desc = category.description || category.title || "No description provided.";
              const color = getRandomColor(category.name);

              return (
                <Box
                  key={category.name}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                    {/* Category Label & Details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, mb: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
                        <Typography sx={{ fontWeight: 700, fontSize: '14.5px', color: '#0f172a' }}>
                          {category.name}
                        </Typography>
                      </Box>

                      {isEditing ? (
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          minRows={2}
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          sx={{ mt: 1, "& .MuiOutlinedInput-root": { borderRadius: 1.5, fontSize: "13px" } }}
                        />
                      ) : (
                        <Typography sx={{ fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>
                          {desc}
                        </Typography>
                      )}
                    </Box>

                    {/* Action Controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {isEditing ? (
                        <>
                          <Tooltip title="Save Changes">
                            <IconButton
                              size="small"
                              onClick={() => handleSaveEdit(category.name)}
                              sx={{ color: '#16a34a', '&:hover': { backgroundColor: '#f0fdf4' } }}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <IconButton
                              size="small"
                              onClick={() => setEditingCategory(null)}
                              sx={{ color: '#64748b', '&:hover': { backgroundColor: '#f1f5f9' } }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      ) : (
                        <>
                          <Tooltip title="Edit Description">
                            <IconButton
                              size="small"
                              onClick={() => handleEditClick(category)}
                              sx={{ color: '#64748b', '&:hover': { color: '#2563eb', backgroundColor: '#f1f5f9' } }}
                            >
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Category">
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteCategory(category.name)}
                              sx={{ color: '#64748b', '&:hover': { color: '#dc2626', backgroundColor: '#fef2f2' } }}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '13.5px', color: '#64748b' }}>
              No custom categories yet. Click "Add New Category" above to create one.
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default NewCategory;
