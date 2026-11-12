import { useState, useContext, useMemo } from "react";
import { createCategory, updateCategory, deleteCategory } from "../../api/categories";
import { emailContext } from "../../context/emailContext";
import { RESERVED, MAX_NAME, SUGGESTIONS } from "./constants";

/**
 * State and actions behind the category manager: the add form, inline description editing and
 * delete confirmation. Categories live in context so the sidebar updates as soon as one changes.
 */
export const useCategoryManager = () => {
  const { categories, setCategories, emails, setUpdate } = useContext(emailContext);
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
      const created = await createCategory({ name: trimmedName, description: description.trim() });
      bumpUpdate();
      setCategories((prev) => [...prev, created]);
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
      const target = categories.find((c) => c.name === name);
      const text = editedDescription.trim();
      await updateCategory(target.id, { description: text });
      setCategories((prev) =>
        prev.map((c) => (c.name === name ? { ...c, description: text, title: text } : c))
      );
      bumpUpdate();
      setEditingCategory(null);
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
      const target = categories.find((c) => c.name === name);
      await deleteCategory(target.id);
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

  return {
    error,
    busy,
    userCategories,
    emailCount,
    form: {
      isAdding,
      startAdd: () => setIsAdding(true),
      cancel: resetAddForm,
      submit: handleCreate,
      name: categoryName,
      setName: setCategoryName,
      description,
      setDescription,
      nameError,
      canCreate,
      creating: busy === "create",
      suggestions: availableSuggestions,
    },
    row: {
      editing: editingCategory,
      editedDescription,
      setEditedDescription,
      startEdit: (category) => {
        setEditingCategory(category.name);
        setEditedDescription(category.description || category.title || "");
      },
      cancelEdit: () => setEditingCategory(null),
      saveEdit: handleSaveEdit,
      confirming: confirmDelete,
      askDelete: setConfirmDelete,
      cancelDelete: () => setConfirmDelete(null),
      confirmDelete: handleDelete,
    },
  };
};
