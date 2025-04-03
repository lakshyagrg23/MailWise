export const url=(oauth2Client)=>(req, res) => {
    console.log(0)
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope : [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly"
        ],
    });
    res.json({ authUrl });
}