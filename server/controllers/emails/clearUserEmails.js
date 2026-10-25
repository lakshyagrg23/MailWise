import prisma from '../../prisma.js';

export const clearUserEmails = async (req, res) => {
    // Prevent deleting the mock emails for the demo account
    if (req.user.isDemo) {
        return res.status(200).json({ message: "Demo emails preserved.", deletedRows: 0 });
    }

    try {
        const result = await prisma.emailMetadata.deleteMany({
            where: { user_id: req.user.id }
        });

        return res.status(200).json({ message: "Emails deleted successfully", deletedRows: result.count });
    } catch (error) {
        console.error("Error deleting emails:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
