/* eslint-disable no-unused-vars */
import React, { useEffect, useState,useContext } from 'react'
import axios from 'axios';
import { Box, Dialog ,InputBase,Typography,styled,TextField,Button} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { API_URLS } from '../api/api.url';
import useApi from "../hooks/useApi"
import { emailContext } from '../App';


const dialogStyle = {
    height: '90%',
    width: '80%',
    maxWidth: '100%',
    maxHeight: '100%',
    boxShadow: 'none',
    borderRadius: '10px 10px 0 0',
}

const Header=styled(Box)({
    display:"flex",
    justifyContent:"space-between",
    padding:"10px 15px",
    background: "#f2f6fc",
    '& > p':{
        fontSize:14,
        fontWeight:500
    }
    

})
const RecipientWrapper = styled(Box)`
    display: flex;
    flex-direction: column;
    padding: 0 15px;
    & > div {
        font-size: 14px;
        line-height:20px;
        text-decoration:none solid rgb(34,34,34)
        border-bottom: 1px solid #F5F5F5;
        margin-top: 10px;
    }
`;
    

const Footer = styled(Box)`
    display: flex;
    justify-content: space-between;
    padding: 36px 20px;
    align-items: center;
`;
const SendButton = styled(Button)`
    background: #0B57D0;
    color: #fff;
    font-weight: 500;
    text-transform: none;
    border-radius: 18px;
    width: 100px;
`
const Compose = ({openDialog,setOpenDialog}) => {
    const [data, setData] = useState({});
    const sendEmail=useApi(API_URLS.saveSentEmail);
    const saveDraft=useApi(API_URLS.SaveDraftEmails);
    const hook=useContext(emailContext)

    const onValueChange=(e)=>{
        setData({ ...data, [e.target.name]: e.target.value })
        console.log(data)

    }

    const closeComposeClick=(e)=>{
        e.preventDefault();
        const payload={
            to:data.to,
            from:"luckygovindrao182@gmail.com",
            subject:data.subject,
            body:data.body,
            date:new Date(),
            image:" ",
            name:"lucky",
            starred:false,
            type:'drafts',
        }
        saveDraft.call(payload);
        if(!saveDraft.error){
            setOpenDialog(false);
            setData({})
        }else{

        }

    }
    const sendMail=async(e)=>{
        e.preventDefault();
        const response=await axios.post("http://localhost:5000/email/send-emails",{
            params:{access_token:hook.accessToken},
            headers:{
                "Content-Type":"application/json",
            },
            body:JSON.stringify(data),
        })
        const result = await response.json();

        if (response.ok) {
            console.log("Email sent successfully:", result);
        } else {
            console.error("Failed to send email:", result);
        }
        setOpenDialog(false);
        
    }
    const deleteMail=()=>{
        setOpenDialog(false)
    }

    return (
    <Dialog
    open={openDialog}
    PaperProps={{ sx: dialogStyle }}
    >

    <Header>

        <Typography >New Message</Typography>
        <CloseIcon fontSize="small" onClick={(e) => closeComposeClick(e)} />


    </Header>
        <RecipientWrapper style={{}}>
        <InputBase placeholder='Recipients' onChange={(e)=>onValueChange(e)} name="to" />
        <InputBase placeholder='Subject' onChange={(e)=>onValueChange(e)} name="subject"/>
        </RecipientWrapper>

        <TextField 
                    multiline
                    rows={10}
                    sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' } }}
                    name="body"
                    onChange={(e)=>onValueChange(e)}
                    
                    
                
                />
            <Footer>
            <SendButton onClick={(e)=> sendMail(e)}>Send</SendButton>

            <DeleteOutlineOutlinedIcon  onClick={()=>deleteMail()}/>
                
                </Footer>

    </Dialog>
    )
}

export default Compose