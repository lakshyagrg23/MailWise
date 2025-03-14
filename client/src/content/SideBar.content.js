import AllInboxIcon from '@mui/icons-material/AllInbox';
import WorkIcon from '@mui/icons-material/Work';
import PersonIcon from '@mui/icons-material/Person';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';


import {Photo, StarOutline, SendOutlined, InsertDriveFileOutlined, DeleteOutlined,
    MailOutlined } from '@mui/icons-material';


export const SIDEBAR_DATA = [
    {
        name: 'All',
        title: 'All Emails',
        icon: AllInboxIcon,
        
    },
    {
        name: 'Essential',
        title: 'Essential',
        icon: WorkIcon,
        
    },
    {
        name: 'Social',
        title: 'Social',
        icon: PersonIcon,
    
    },
    {
        name: 'Promotions',
        title: 'Promotions',
        icon: SendOutlined,
        
    },
    {
        name: 'Updates',
        title: 'Updates',
        icon: HourglassBottomIcon,
    },
    {
        name: 'Finance',
        title: 'Finance',
        icon: AccountBalanceWalletIcon,
    },
    {
        name: 'Subscriptions',
        title: 'Subscriptions',
        icon: EventRepeatIcon,

    },
    {
        name: 'Miscellaneous',
        title: 'Miscellaneous',
        icon: MiscellaneousServicesIcon,
    }
];