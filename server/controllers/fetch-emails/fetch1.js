import { google } from 'googleapis';
import {fork} from "child_process";
import axios from 'axios';
import dotenv from 'dotenv';
import os from "os";
import prisma from '../../prisma.js';  

dotenv.config();
const THREAD_COUNT=5;


export const fetch1 = async (req, res) => {
    const { category } = req.params;
    const accessToken = req.query.access_token;

    if (!accessToken) {
        return res.status(401).json({ error: "Missing access token" });
    }

    if (accessToken === "demo") {
        const user = await prisma.user.findUnique({ where: { google_id: 'demo_google_id' } });
        if (!user) return res.status(404).json({ error: "Demo user not found" });
        
        const whereClause = { user_id: user.id };
        if (category !== "All") {
            whereClause.category = { equals: category, mode: 'insensitive' };
        }
        
        const storedEmails = await prisma.emailMetadata.findMany({ where: whereClause, orderBy: { received_date: 'desc' } });
        
        const serializedDemoEmails = storedEmails.map(email => ({
            ...email,
            update: email.update ? email.update.toString() : null
        }));

        return res.json({
            emails: serializedDemoEmails,
            name: user.name,
            pic: user.profile_pic_url,
            email: user.email
        });
    }

    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
        const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const googleId = userInfoResponse.data.id;

        // Retrieve user_id from database
        const user = await prisma.user.findUnique({
            where: { google_id: googleId },
            select: { id: true }
        });
        
        if (!user) {
            return res.status(404).json({ error: "User not found in database" });
        }
        const userId = user.id;

        // Fetch stored emails from the database
        const whereClause = { user_id: userId };
        if (category !== "All") {
            whereClause.category = { equals: category, mode: 'insensitive' };
        }
        
        const storedEmails = await prisma.emailMetadata.findMany({
            where: whereClause,
            orderBy: { received_date: 'desc' }
        });

        if (storedEmails.length > 0) {
            const serializedEmails = storedEmails.map(email => ({
                ...email,
                update: email.update ? email.update.toString() : null
            }));
            
            return res.json({ emails: serializedEmails,
                name:userInfoResponse.data.name,
                pic:userInfoResponse.data.picture,
                email:userInfoResponse.data.email
             });
        }

        // No stored emails found, fetch from Gmail API
        const response = await gmail.users.messages.list({ userId: 'me', maxResults: 15 });
        const messages = response.data.messages || [];
        
        let workerPromises=[];
        for(let i=0;i<THREAD_COUNT;i++){
            const worker=fork("./controllers/fetch-emails/worker.js");
            
            worker.send({ messages: messages.slice(i * Math.ceil(messages.length / THREAD_COUNT), (i + 1) * Math.ceil(messages.length / THREAD_COUNT)), userId: userId,accessToken:accessToken });

            workerPromises.push(
                new Promise((resolve,reject)=>{
                    worker.on("message",(data)=>{
                        resolve(data)
                    });
                    worker.on("exit",() => console.log("Worker exited"));
                    worker.on("error",reject);
                })
            )
        }
        const results=await Promise.all(workerPromises)
        const emails=results.flat();
        
        res.json({ emails,
            name:userInfoResponse.data.name,
            pic:userInfoResponse.data.picture,
            email:userInfoResponse.data.email });
    } catch (error) {
        console.error("Error fetching/classifying emails:", error);
        res.status(500).json({ error: "Failed to fetch/classify emails" });
    }
};
