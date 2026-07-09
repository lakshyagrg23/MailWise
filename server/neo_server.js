import express from 'express';
import cors from 'cors';
import authRoutes from "./routes/auth_routes.js"
import fetchEmailRoutes from "./routes/fetchEmailRoutes.js"
import categories from "./routes/categories.js"
import fetchBody from "./routes/fetchBody.js"
import email from "./routes/email.js"
import New_mail from"./routes/New_mail.js"
import prisma from './prisma.js';

BigInt.prototype.toJSON = function() { return this.toString() }

const app = express();

// Define an array of allowed origins
const allowedOrigins = [
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:80',
  'https://main.d2n81lupyovp57.amplifyapp.com',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());


app.use("/auth",authRoutes)
app.use("/fetch-emails",fetchEmailRoutes)
app.use("/fetch-email",fetchBody)
app.use("/categories",categories)
app.use("/email",email)
app.use("/webhook",New_mail)


app.delete("/emails/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (user && user.google_id === 'demo_google_id') {
            // Prevent deleting the mock emails for the demo account
            return res.status(200).json({ message: "Demo emails preserved.", deletedRows: 0 });
        }

        const result = await prisma.emailMetadata.deleteMany({
            where: { user_id: parseInt(userId) }
        });

        res.status(200).json({ message: "Emails deleted successfully", deletedRows: result.count });
    } catch (error) {
        console.error("Error deleting emails:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));