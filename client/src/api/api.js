import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const fetchEmails = async (category, accessToken,date) => {
    try {
        if(!(date instanceof Date))date=new Date();
        const dateString=date.toISOString();
        const response = await axios.get(`${API_URL}/fetch-emails/${category}`, {
            params: { 
                access_token: accessToken ,
                date:dateString
            }
        });
        console.log(response.data)
        const email=response.data.email;
        const pic=response.data.pic;
        const emails=response.data.emails;
        return {emails,email,pic}; 
    } catch (error) {
        console.error("Error fetching emails:", error);
        return [];
    }
};

export default fetchEmails;
