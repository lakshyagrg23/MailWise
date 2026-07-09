import React, { useState, useContext } from "react";
import axios from "axios";
import { emailContext } from "../App";
import { Edit, Save, X, Plus, Info, Trash2 } from "lucide-react";

const NewCategory = () => {
  const { categories, setCategories,update,setUpdate } = useContext(emailContext);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  };

  const userId = getQueryParam("user_id");

  const handleEditClick = (category) => {
    setEditingCategory(category.name);
    const currentDesc = category.description || category.title || "";
    setEditedDescription(currentDesc);
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim() || !description.trim()) return;

    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}`, {
        newCategoryName: categoryName,
        newDescription: description,
        update:parseInt(update)+1
      });

      const newCategory = response.data;
      let h=parseInt(update)+1
      setUpdate(h);
      setCategories([...categories, newCategory]);
      setIsModalOpen(false);
      setCategoryName("");
      setDescription("");
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  const handleSave = async (name) => {
    if (!userId || !editedDescription) return;

    try {
      const response = await axios.put(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}/${name}`, {
        newCategoryName: name,
        newDescription: editedDescription,
        update:parseInt(update)+1
      });

      if (response.status === 200) {
        setCategories((prev) =>
          prev.map((c) => (c.name === name ? { ...c, description: editedDescription } : c))
        );
        let h=parseInt(update)+1
        setUpdate(h);
        setEditingCategory(null);
      }
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleAddCategory = () => setIsModalOpen(true);

  const closeModal = () => {
    const confirmClose = window.confirm("Are you sure you want to discard this new category?");
    if (confirmClose) {
      setIsModalOpen(false);
      setCategoryName("");
      setDescription("");
    }
  };

  const handleCategorySelection = (categoryName) => {
    setSelectedCategories((prevSelected) =>
      prevSelected.includes(categoryName)
        ? prevSelected.filter((name) => name !== categoryName)
        : [...prevSelected, categoryName]
    );
  };

  const handleConfirmDelete = async () => {
    if (!userId || selectedCategories.length === 0) return;

    try {
      await Promise.all(
        selectedCategories.map((categoryName) =>
          axios.delete(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/categories/${userId}/${categoryName}`,{
            data:{
              update:parseInt(update)+1
            }
          })
        )
      );
      let h=parseInt(update)+1
      setUpdate(h);
      setCategories(categories.filter((category) => !selectedCategories.includes(category.name)));
      setSelectedCategories([]);
      setIsDeleteModalOpen(false);
    } catch (error) {
      console.error("Error deleting categories:", error);
    }
  };

  return (
    <div className="min-h-screen w-full max-w-5xl mx-auto px-6 py-10 font-inter text-gray-900">
      <div className="bg-white rounded-xl shadow-md border border-gray-300 p-6">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <h2 className="text-3xl font-semibold text-blue-600 tracking-wide">Email Categories</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleAddCategory}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition duration-200 shadow-sm"
            >
              <Plus size={18} className="mr-2" />
              New Category
            </button>
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className={`bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center transition duration-200 shadow-sm ${
                selectedCategories.length === 0 ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={selectedCategories.length === 0}
            >
              <Trash2 size={18} className="mr-2" />
              Delete Selected
            </button>
          </div>
        </div>

        {categories.filter((c) => c.name !== "All").length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-xl border border-gray-300 shadow-inner">
            <Info size={48} className="text-blue-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Categories Yet</h3>
            <p className="text-gray-600 text-sm mb-6 max-w-md text-center">
              Categories help you organize your emails into a structured, clear view. Create your first category.
            </p>
            <button
              onClick={handleAddCategory}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md shadow-md transition"
            >
              Create First Category
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.filter((c) => c.name !== "All").map((category) => {
              const isEditing = editingCategory === category.name;
              const desc = category.description || category.title || "No description yet";

              return (
                <div
                  key={category.name}
                  className="bg-gray-50 border border-gray-300 p-4 rounded-lg hover:shadow-md transition-shadow duration-300 ease-in-out"
                >
                  <div className="flex justify-between items-start gap-6">
                    <div className="w-full">
                      <h3 className="text-lg font-semibold text-gray-800">{category.name}</h3>
                      {isEditing ? (
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          className="mt-2 bg-white border border-gray-300 text-gray-900 p-3 rounded-md w-full h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      ) : (
                        <p className="text-sm text-gray-600 mt-1">{desc}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(category.name)}
                            className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-md transition"
                            title="Save"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="bg-gray-400 hover:bg-gray-500 text-white p-2 rounded-md transition"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEditClick(category)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      <label className="flex items-center text-sm text-gray-700 mt-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.name)}
                          onChange={() => handleCategorySelection(category.name)}
                          className="mr-2 rounded border-gray-300"
                        />
                        Select
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal for New Category */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white text-gray-900 p-8 rounded-xl shadow-lg border border-gray-300 w-full max-w-lg animate-fadeIn scale-100 transition-transform">
            <h2 className="text-2xl font-semibold mb-6 text-blue-600">Create New Category</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm mb-1 block text-gray-700">Category Name</label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="eg. Starlogs, Client AI, Spam Nebula"
                  className="w-full bg-white border border-gray-300 p-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-sm mb-1 block text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this category used for?"
                  className="w-full bg-white border border-gray-300 p-3 rounded-md h-28 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end mt-6 space-x-4">
              <button
                onClick={closeModal}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-md transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={!categoryName.trim() || !description.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md disabled:opacity-50 transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Delete Confirmation */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-40 backdrop-blur-sm">
          <div className="bg-white text-gray-900 p-8 rounded-xl shadow-lg border border-gray-300 w-full max-w-lg animate-fadeIn">
            <h2 className="text-2xl font-semibold mb-6 text-red-600">Confirm Deletion</h2>
            <p className="mb-4 text-gray-700">Are you sure you want to delete the selected categories?</p>
            <div className="flex justify-end mt-6 space-x-4">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-5 py-2 rounded-md transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-md transition"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCategory;
