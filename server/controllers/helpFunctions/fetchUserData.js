import axios from 'axios';
export const data=async(accessToken)=>{
    const userResponse = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    console.log(userResponse.data.id)
    return userResponse.data.id;
}