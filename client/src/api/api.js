import axios from 'axios';

const API_URL = "http://localhost:5000";

const fetchEmails = async (category, accessToken) => {
    try {
        const response = await axios.get(`${API_URL}/fetch-emails/${category}`, {
            params: { access_token: accessToken }
        });
        console.log(response)
        return response.data.emails; 
    } catch (error) {
        console.error("Error fetching emails:", error);
        return [];
    }
};

export default fetchEmails;
