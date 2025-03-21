import React from 'react';
import { Drawer } from '@mui/material';
import SideBarContent from './SideBarContent';

const SideBar = ({ openDrawer, setSelectedCategory }) => {
  return (
    <Drawer
      anchor="left"
      open={openDrawer}
      hideBackdrop={true}
      ModalProps={{ keepMounted: true }}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          width: 250,
          borderRight: 'none',
          background: '#f5f5f5',
          marginTop: '64px',
          height: 'calc(100vh - 64px)',
        },
      }}
    >
      <SideBarContent setSelectedCategory={setSelectedCategory} />
    </Drawer>
  );
};

export default SideBar;
