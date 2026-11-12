import prisma from '../../lib/prisma.js';
import { createSession } from '../../utils/session.js';
import { DEFAULT_CATEGORIES } from '../../config/categories.js';
import { DEMO_GOOGLE_ID } from '../../middleware/requireAuth.js';

export const demoLogin = async (req, res) => {
    let user = await prisma.user.findUnique({ where: { google_id: DEMO_GOOGLE_ID } });

    if (!user) {
        user = await prisma.user.create({
            data: {
                google_id: DEMO_GOOGLE_ID,
                name: 'Demo User',
                email: 'demo@mailwise.app',
                profile_pic_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
                access_token: 'demo',
                refresh_token: 'demo_refresh'
            }
        });
    }

    // Seed realistic emails
    const emails = [
        { email_id: 'demo_1', is_read: false, subject: 'Your Interview Schedule', sender: 'careers@techcorp.com', category: 'Essential', emailsummary: 'Your interview is scheduled for next Tuesday at 10 AM.', received_date: new Date(Date.now() - 1000 * 60 * 30) },
        { email_id: 'demo_2', is_read: false, subject: 'Your Amazon order has shipped!', sender: 'orders@amazon.com', category: 'Updates', emailsummary: 'Your package containing "Wireless Headphones" has shipped and will arrive tomorrow.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 2) },
        { email_id: 'demo_3', subject: 'Monthly Statement for Account #1234', sender: 'statements@chase.com', category: 'Finance', emailsummary: 'Your monthly credit card statement is now available to view online.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 5) },
        { email_id: 'demo_4', subject: 'Flash Sale: 50% Off All Items', sender: 'promo@store.com', category: 'Promotions', emailsummary: 'Huge flash sale today only! Get 50% off sitewide.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 12) },
        { email_id: 'demo_5', subject: 'Jane liked your photo', sender: 'notifications@instagram.com', category: 'Social', emailsummary: 'Jane Doe liked your recent photo.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 24) },
        { email_id: 'demo_6', is_read: false, subject: 'Your weekly digest from Medium', sender: 'noreply@medium.com', category: 'Subscriptions', emailsummary: 'Top stories for you this week in Technology and Design.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 48) },
        { email_id: 'demo_7', subject: 'Flight Confirmation: NY to LA', sender: 'booking@delta.com', category: 'Essential', emailsummary: 'Your flight DL123 is confirmed. Departs NY at 8:00 AM.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 72) },
        { email_id: 'demo_8', subject: 'Your Netflix subscription price is changing', sender: 'billing@netflix.com', category: 'Finance', emailsummary: 'Your monthly plan price will increase by $1 starting next month.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 96) },
        { email_id: 'demo_9', subject: 'Join our upcoming webinar', sender: 'marketing@saas.io', category: 'Miscellaneous', emailsummary: 'Learn how to optimize your workflow in our free webinar.', received_date: new Date(Date.now() - 1000 * 60 * 60 * 120) }
    ];

    // Reset + reseed atomically so concurrent visitors never see a half-seeded demo account
    await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { access_token: 'demo' } }),
        prisma.categoryPreference.deleteMany({ where: { user_id: user.id } }),
        prisma.emailMetadata.deleteMany({ where: { user_id: user.id } }),
        prisma.categoryPreference.createMany({
            data: DEFAULT_CATEGORIES.map(c => ({
                user_id: user.id,
                category_name: c.name,
                category_description: c.description
            }))
        }),
        prisma.emailMetadata.createMany({ data: emails.map(e => ({ user_id: user.id, ...e })) })
    ]);

    createSession(res, user.id);
    return res.json({ ok: true });
};
