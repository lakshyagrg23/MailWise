const getQueryParam = (param) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
};

export const Refresh = async () => {
    const userId = getQueryParam("user_id");
    if (!userId) return console.error("Missing userId");
    try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/emails/${userId}`, {
            method: "DELETE",
        });
        if (response.ok) {
            console.log("Old emails deleted.");
            window.location.reload();
        } else {
            console.error("Error deleting emails.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
};