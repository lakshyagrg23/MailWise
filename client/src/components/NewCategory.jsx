import React, { useState, useContext } from "react";
import { emailContext } from "../App";
import { Edit, Save, X, Plus, Info,Trash2 } from "lucide-react";

const NewCategory = () => {
  const { categories, setCategories } = useContext(emailContext);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedDescription, setEditedDescription] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");

  const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  };

  const userId = getQueryParam("user_id");

  // Instead of using index, we'll use the category name as a unique identifier
  const handleEditClick = (category) => {
    setEditingCategory(category.name);
    // Use the same logic to get description as used in rendering
    const currentDesc = category.description || category.title || "";
    setEditedDescription(currentDesc);
    console.log("Editing category:", category);
  };

  const handleDeleteCategory = async (name) => {
    if (!userId) {
      console.error("Error: userId is missing or null.");
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/categories/${userId}/${name}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCategories(categories.filter((category) => category.name !== name));
      } else {
        console.error("Error: Failed to delete category. Status:", response.status);
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim() || !description.trim()) return;
    
    try {
      const response = await fetch(`http://localhost:5000/categories/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newCategoryName: categoryName,
          newDescription: description
        }),
      });
      
      if (response.ok) {
        const newCategory = await response.json();
        setCategories([...categories, newCategory]); // Update UI
        setIsModalOpen(false);
        setCategoryName("");
        setDescription("");
      }
    } catch (error) {
      console.error("Error creating category:", error);
    }
  };

  const handleSave = async (name) => {
    if (!userId) {
      console.error("Error: userId is missing or null.");
      return;
    }
  
    if (!editedDescription) {
      console.error("Error: No description provided.");
      return;
    }
  
    try {
      const response = await fetch(`http://localhost:5000/categories/${userId}/${name}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newCategoryName: name,
          newDescription: editedDescription
        }),
      });
  
      if (response.ok) {
        setCategories((prevCategories) =>
          prevCategories.map((cat) =>
            cat.name === name ? { ...cat, description: editedDescription } : cat
          )
        );
        setEditingCategory(null);
      } else {
        console.error("Error: Failed to update category. Status:", response.status);
        const errorData = await response.json();
        console.error("Server Response:", errorData);
      }
    } catch (error) {
      console.error("Error updating category:", error);
    }
  };

  const handleAddCategory = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="flex flex-col min-h-screen w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-6 m-4 border border-gray-200 flex-grow">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Email Categories</h2>
          <button
            onClick={handleAddCategory}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors duration-200"
          >
            <Plus size={18} className="mr-2" />
            New Category
          </button>
        </div>
        
        {categories.filter(category => category.name !== "All").length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-gray-50 rounded-lg border border-gray-200">
            <Info size={48} className="text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">No Categories Yet</h3>
            <p className="text-gray-500 max-w-md">
              Categories help you organize your emails. Start by creating your first category.
            </p>
            <button
              onClick={handleAddCategory}
              className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg transition-colors duration-200"
            >
              Create First Category
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            {categories
              .filter((category) => category.name !== "All")
              .map((category) => {
                console.log("Category data:", category);
                
                // Get description using consistent logic
                const categoryDescription = category.description || category.title || "No description provided";
                const isEditing = editingCategory === category.name;
                
                return (
                <div
                  key={category.name}
                  className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow duration-200 bg-white p-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-grow">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">{category.name}</h3>
                      
                      {isEditing ? (
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          className="border border-gray-300 p-2 rounded-lg w-full h-20 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter category description..."
                        />
                      ) : (
                        <p className="text-gray-600 text-sm">
                          {categoryDescription}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 ml-4">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(category.name)}
                            className="bg-green-500 hover:bg-green-600 text-white p-1.5 rounded transition-colors"
                            title="Save changes"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingCategory(null)}
                            className="bg-gray-500 hover:bg-gray-600 text-white p-1.5 rounded transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleEditClick(category)}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded transition-colors"
                          title="Edit description"
                        >
                          <Edit size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCategory(category.name)}
                        className="bg-red-500 text-white p-2 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              )})}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md border border-gray-300 animate-fadeIn">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              Create New Category
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  className="border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 rounded-lg w-full outline-none"
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter category description"
                  className="border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent p-3 rounded-lg w-full h-32 resize-none outline-none"
                />
              </div>
            </div>
            <div className="flex justify-between mt-6">
              <button
                onClick={closeModal}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium px-5 py-2.5 rounded-lg w-5/12 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCategory}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg w-6/12 transition-colors"
                disabled={!categoryName.trim() || !description.trim()}
              >
                Create Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewCategory;