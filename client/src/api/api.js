import http from './http';

const fetchEmails = async (category) => {
    try {
        const response = await http.get(`/fetch-emails/${encodeURIComponent(category)}`);

        const email = response.data?.email;
        const pic = response.data?.pic;
        const name = response.data?.name;
        const emails = response.data?.emails || [];

        return { emails, email, pic, name };
    } catch (error) {
        console.error("Error fetching emails:", error);
        return { emails: [] };
    }
};

export default fetchEmails;
