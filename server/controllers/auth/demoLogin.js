import prisma from '../../prisma.js';

export const demoLogin = async (req, res) => {
    try {
        let user = await prisma.user.findUnique({ where: { google_id: 'demo_google_id' } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    google_id: 'demo_google_id',
                    name: 'Demo User',
                    email: 'demo@mailwise.app',
                    profile_pic_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
                    access_token: 'demo',
                    refresh_token: 'demo_refresh'
                }
            });
        } else {
            // Wipe existing demo data for a fresh start on every login
            await prisma.user.update({
                where: { id: user.id },
                data: { access_token: 'demo' }
            });
            await prisma.categoryPreference.deleteMany({ where: { user_id: user.id } });
            await prisma.emailMetadata.deleteMany({ where: { user_id: user.id } });
        }

        // Seed categories
        const categories = [
            { name: "Essential", description: "Important career, academic, or life updates such as job offers, exam schedules, etc." },
            { name: "Social", description: "Personal communications and social media notifications." },
            { name: "Promotions", description: "Marketing, sales, and product launch announcements." },
            { name: "Updates", description: "Order status, service updates, or time-sensitive event notifications." },
            { name: "Finance", description: "Banking, billing, investment updates." },
            { name: "Subscriptions", description: "Regular newsletters, content updates from subscribed services." },
            { name: "Miscellaneous", description: "Everything else." }
        ];

        for (const cat of categories) {
            await prisma.categoryPreference.create({
                data: {
                    user_id: user.id,
                    category_name: cat.name,
                    category_description: cat.description
                }
            });
        }

        // Seed realistic emails
        const emails = [
            { email_id: 'demo_1', subject: 'Your Interview Schedule', sender: 'careers@techcorp.com', category: 'Essential', emailsummary: 'Your interview is scheduled for next Tuesday at 10 AM.', received_date: new Date(Date.now() - 1000 * 60 * 30) },
            { email_id: 'demo_2', subject: 'Your Amazon order has shipped!', sender: 'orders@amazon.com', category: 'Updates', emailsummary: 'Your package containing "Wireless Headphones" has shipped and will arrive tomorrow.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 2) },
            { email_id: 'demo_3', subject: 'Monthly Statement for Account #1234', sender: 'statements@chase.com', category: 'Finance', emailsummary: 'Your monthly credit card statement is now available to view online.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 5) },
            { email_id: 'demo_4', subject: 'Flash Sale: 50% Off All Items', sender: 'promo@store.com', category: 'Promotions', emailsummary: 'Huge flash sale today only! Get 50% off sitewide.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 12) },
            { email_id: 'demo_5', subject: 'Jane liked your photo', sender: 'notifications@instagram.com', category: 'Social', emailsummary: 'Jane Doe liked your recent photo.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 24) },
            { email_id: 'demo_6', subject: 'Your weekly digest from Medium', sender: 'noreply@medium.com', category: 'Subscriptions', emailsummary: 'Top stories for you this week in Technology and Design.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 48) },
            { email_id: 'demo_7', subject: 'Flight Confirmation: NY to LA', sender: 'booking@delta.com', category: 'Essential', emailsummary: 'Your flight DL123 is confirmed. Departs NY at 8:00 AM.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 72) },
            { email_id: 'demo_8', subject: 'Your Netflix subscription price is changing', sender: 'billing@netflix.com', category: 'Finance', emailsummary: 'Your monthly plan price will increase by $1 starting next month.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 96) },
            { email_id: 'demo_9', subject: 'Join our upcoming webinar', sender: 'marketing@saas.io', category: 'Miscellaneous', emailsummary: 'Learn how to optimize your workflow in our free webinar.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 120) }
        ];

        for (const email of emails) {
            await prisma.emailMetadata.create({
                data: {
                    user_id: user.id,
                    ...email
                }
            });
        }

        res.redirect(`${process.env.FRONTEND_URL}/emails/inbox?access_token=demo&user_id=${user.id}&name=${encodeURIComponent(user.name)}&update=1`);
    } catch (error) {
        console.error('Demo Login Error:', error);
        res.status(500).json({ error: 'Failed to create or fetch demo account' });
    }
};
