import prisma from '../../prisma.js';

export const clearUserEmails = async (req, res) => {
    const { userId } = req.params;

    if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({ error: "A valid userId is required" });
    }

    try {
        const parsedUserId = parseInt(userId);
        const user = await prisma.user.findUnique({ where: { id: parsedUserId } });

        if (user && user.google_id === 'demo_google_id') {
            // Prevent deleting the mock emails for the demo account
            return res.status(200).json({ message: "Demo emails preserved.", deletedRows: 0 });
        }

        const result = await prisma.emailMetadata.deleteMany({
            where: { user_id: parsedUserId }
        });

        return res.status(200).json({ message: "Emails deleted successfully", deletedRows: result.count });
    } catch (error) {
        console.error("Error deleting emails:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
