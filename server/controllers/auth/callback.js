import axios from 'axios';
import prisma from '../../prisma.js';
import globalStore from '../helpFunctions/global.js';

const defaultCategories = [
    { name: "Essential", description: "Important career, academic, or life updates such as job offers, exam schedules, etc." },
    { name: "Social", description: "Personal communications and social media notifications." },
    { name: "Promotions", description: "Marketing, sales, and product launch announcements." },
    { name: "Updates", description: "Order status, service updates, or time-sensitive event notifications." },
    { name: "Finance", description: "Banking, billing, investment updates." },
    { name: "Subscriptions", description: "Regular newsletters, content updates from subscribed services." },
    { name: "Miscellaneous", description: "Everything else." }
];

export const callback = (oauth2Client) => async (req, res) => {
    try {
        const { code } = req.query;
        console.log("Received OAuth code:", code); // Debugging log

        const { tokens } = await oauth2Client.getToken(code);
        console.log("Received OAuth tokens:", tokens); // Debugging log

        oauth2Client.setCredentials(tokens);
        const accessToken = tokens.access_token;
        globalStore.accessToken=accessToken;
        globalStore.oauth2Client=oauth2Client;
        // Fetch user details using the access token
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        console.log("User Info Response:", userInfoResponse.data); // Debugging log

        const userEmail = userInfoResponse.data.email;
        const userName = userInfoResponse.data.name;
        const userpic = userInfoResponse.data.picture;

        // Check if the user exists in the database
        const userCheckResult = await prisma.user.findUnique({
            where: { email: userEmail },
            select: { id: true, update: true }
        });
        
        let userId, update;
        if (!userCheckResult) {
            // User doesn't exist, insert them into the database
            const userResult = await prisma.user.create({
                data: {
                    google_id: userInfoResponse.data.id,
                    name: userName,
                    email: userEmail,
                    profile_pic_url: userpic,
                    update: 1
                },
                select: { id: true, update: true }
            });
            userId = userResult.id;
            update = userResult.update;
            console.log("New user authenticated with ID:", userId);

            // Insert default categories for the new user
            await insertDefaultCategories(userId);
        } else {
            // User already exists, just get their ID
            userId = userCheckResult.id;
            update = userCheckResult.update;
            console.log("Existing user authenticated with ID:", userId);
        }

        // Redirect with access token, user ID, and name
        res.redirect(`${process.env.FRONTEND_URL}/emails/inbox?access_token=${accessToken}&user_id=${userId}&name=${encodeURIComponent(userName)}&update=${update}`);
    } catch (error) {
        console.error("Error during OAuth callback:", error);
        res.status(500).send("Authentication failed");
    }
};

// Ensure insertDefaultCategories is defined somewhere
async function insertDefaultCategories(userId) {
    try {
        const categoriesData = defaultCategories.map(category => ({
            user_id: parseInt(userId),
            category_name: category.name,
            category_description: category.description
        }));
        await prisma.categoryPreference.createMany({
            data: categoriesData,
            skipDuplicates: true
        });
        console.log(`Default categories inserted for user ${userId}`);
    } catch (error) {
        console.error("Error inserting default categories:", error);
    }
}
