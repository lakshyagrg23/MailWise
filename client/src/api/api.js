import http from './http';

const fetchEmails = async (category, pageToken) => {
    try {
        const response = await http.get(`/fetch-emails/${encodeURIComponent(category)}`, {
            params: pageToken ? { pageToken } : undefined,
        });

        const email = response.data?.email;
        const pic = response.data?.pic;
        const name = response.data?.name;
        const emails = response.data?.emails || [];

        const nextPageToken = response.data?.nextPageToken || null;

        return { emails, email, pic, name, nextPageToken };
    } catch (error) {
        console.error("Error fetching emails:", error);
        return { emails: [], error: true };
    }
};

export default fetchEmails;
