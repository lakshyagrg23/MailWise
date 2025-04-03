import express from 'express';
import cors from 'cors';
import authRoutes from "./routes/auth_routes.js"
import fetchEmailRoutes from "./routes/fetchEmailRoutes.js"
import categories from "./routes/categories.js"
import fetchBody from "./routes/fetchBody.js"
import email from "./routes/email.js"
import pool from './db.js';


const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());


app.use("/auth",authRoutes)
app.use("/fetch-emails",fetchEmailRoutes)
app.use("/fetch-email",fetchBody)
app.use("/categories",categories)
app.use("/email",email)


app.delete("/emails/:userId", async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await pool.query("DELETE FROM email_metadata WHERE user_id = $1", [userId]);

        res.status(200).json({ message: "Emails deleted successfully", deletedRows: result.rowCount });
    } catch (error) {
        console.error("Error deleting emails:", error);
        res.status(500).json({ error: "Internal server error" });
    }
    });


const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));