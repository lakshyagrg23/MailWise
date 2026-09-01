import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const fetchEmails = async (category, accessToken, userId, date) => {
    try {
        const token = accessToken || localStorage.getItem('mailwise_token');
        const uid = userId || localStorage.getItem('mailwise_user_id');

        if (!token) return { emails: [] };

        if (!(date instanceof Date)) date = new Date();
        const dateString = date.toISOString();

        const response = await axios.get(`${API_URL}/fetch-emails/${category}`, {
            params: { 
                access_token: token,
                user_id: uid,
                date: dateString
            }
        });

        const activeToken = response.data?.activeToken || token;
        if (response.data?.activeToken && response.data.activeToken !== token) {
            localStorage.setItem('mailwise_token', response.data.activeToken);
        }

        const email = response.data?.email;
        const pic = response.data?.pic;
        const emails = response.data?.emails || [];

        return { emails, email, pic, activeToken }; 
    } catch (error) {
        console.error("Error fetching emails:", error);
        return { emails: [] };
    }
};

export default fetchEmails;
