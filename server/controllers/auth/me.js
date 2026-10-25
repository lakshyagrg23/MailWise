import prisma from '../../prisma.js';

export const me = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, name: true, email: true, profile_pic_url: true }
        });
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        return res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            pic: user.profile_pic_url,
            isDemo: req.user.isDemo
        });
    } catch (error) {
        console.error('Error in /auth/me:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
