import { google } from 'googleapis';
import {fork} from "child_process";
import axios from 'axios';
import dotenv from 'dotenv';
import pool from '../../db.js';  
import { data } from '../helpFunctions/fetchUserData.js';

dotenv.config();
const THREAD_COUNT=16;


export const fetch1 = async (req, res) => {
    const { category } = req.params;
    const accessToken = req.query.access_token;

    if (!accessToken) {
        return res.status(401).json({ error: "Missing access token" });
    }

    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: authClient });

    try {
        const googleId = await data(accessToken);

        // Retrieve user_id from database
        const userResult = await pool.query("SELECT id FROM users WHERE google_id = $1", [googleId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "User not found in database" });
        }
        const userId = userResult.rows[0].id;

        // Fetch stored emails from the database
        let emailQuery = "SELECT * FROM email_metadata WHERE user_id = $1";
    
        let queryParams = [userId];

        if (category !== "All") {
            emailQuery += " AND LOWER(category) = LOWER($2)";
            queryParams.push(category);
        }

        const emailResult = await pool.query(emailQuery, queryParams);

        if (emailResult.rows.length > 0) {
            return res.json({ emails: emailResult.rows });
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
        console.log(results[1])

        res.json({ emails });
    } catch (error) {
        console.error("Error fetching/classifying emails:", error);
        res.status(500).json({ error: "Failed to fetch/classify emails" });
    }
};
