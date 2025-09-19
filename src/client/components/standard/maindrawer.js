import React, { useState, useEffect } from 'react';
import {  
  Drawer, 
  List, 
  ListItem, 
  ListItemButton,
  ListItemIcon, 
  ListItemText, 
  IconButton,
  Switch,
  ListItemAvatar,
  Avatar,
} from '@mui/material';
import { Home } from '@mui/icons-material';
import { Menu } from '@mui/icons-material';
import { Logout } from '@mui/icons-material';
import { Login } from '@mui/icons-material';
import { AddTask } from '@mui/icons-material';
import { Tune } from '@mui/icons-material';
import { ConfirmationNumber, Report, AdminPanelSettings } from '@mui/icons-material';
import { useRouter } from 'next/router';
import { makeStyles } from 'tss-react/mui';
import NewGameListOption from '../newgameoption';
import { stateManager } from '@src/client/statemanager';


const useStyles = makeStyles()((theme) => ({
  loginOrLogoutButton: {
    marginTop: 'auto',
  },
}));

export function MainDrawer(props) { 
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { loading, account, setAccountPreference, editMode, hasServicePerms } = React.useContext(stateManager);
  const [editModeCheckboxSetting, setEditModeCheckboxSetting] = useState(false); // [true, function
  const router = useRouter();
  const { classes } = useStyles();
  const { theme } = props;

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  useEffect(() => {
    if (typeof editMode != "undefined" && editMode != null) {
      setEditModeCheckboxSetting(editMode);
    }
  }, [editMode]);

  function handleToggleEditMode(newSetting) {
    setAccountPreference("editMode", newSetting);
  }

  const isLoggedIn = !loading && account;
  const baseUri = router.asPath;

  function loggedInView() {
    return (
      <List>
          <ListItem>
            <ListItemAvatar>
              <Avatar
                src={account.profile?.profilePictureUrl}
                alt={account.profile?.displayName ? account.profile?.displayName : account.email}
              />
            </ListItemAvatar>
            <ListItemText primary={account.profile?.displayName ? account.profile?.displayName : account.email} />
          </ListItem>
          <ListItemButton component="a" href="/" onClick={toggleDrawer}>
            <ListItemIcon>
              <Home />
            </ListItemIcon>
            <ListItemText primary="Home" />
          </ListItemButton>
          <ListItemButton component="a" href={`/account/preferences`} onClick={toggleDrawer}  className={classes.loginOrLogoutButton}>
            <ListItemIcon>
              <Tune />
            </ListItemIcon>
            <ListItemText primary="Preferences" />
          </ListItemButton>
          {(account && account.roles.servicePermissions.includes('service_editMode')) ? (
          <ListItem>
            <ListItemText primary="Edit Mode" />
            <Switch
              checked={editModeCheckboxSetting}
              onChange={(e) => handleToggleEditMode(e.target.checked)}
              color="primary"
            />
          </ListItem>) : null}
          
          {(hasServicePerms("service_modifyGlobalPermissions")) ? (
          <ListItemButton component="a" href="/admin/codes" >
          <ListItemIcon>
            <ConfirmationNumber />
          </ListItemIcon>
            <ListItemText primary="Invite codes" />
          </ListItemButton>) : null}
          {(hasServicePerms("service_modifyGlobalPermissions")) ? (
          <ListItemButton component="a" href="/admin/accessapprovals" >
          <ListItemIcon>
            <AddTask />
          </ListItemIcon>
            <ListItemText primary="Access reqeuests" />
          </ListItemButton>) : null}
          
          {(hasServicePerms("service_modifyGlobalPermissions")) ? (
          <ListItemButton component="a" href="/admin/userpermissions" >
          <ListItemIcon>
            <AdminPanelSettings />
          </ListItemIcon>
            <ListItemText primary="User Permissions" />
          </ListItemButton>) : null}
          {(hasServicePerms("service_modifyGlobalPermissions")) ? (
          <ListItemButton component="a" href="/admin/siteaccess" >
          <ListItemIcon>
            <Report />
          </ListItemIcon>
            <ListItemText primary="Site Access" />
          </ListItemButton>) : null}

          {(account && editMode) ? (
            <NewGameListOption  />
          ) : null}
          <ListItemButton component="a" href={`/auth/logout?returnTo=${encodeURIComponent(baseUri)}`} onClick={toggleDrawer}  className={classes.loginOrLogoutButton}>
          <ListItemIcon>
            <Logout />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItemButton>
      </List>
      );
  }


  function loggedOutView() {
    return (
        <List>
            <ListItemButton component="a" href="/" onClick={toggleDrawer}>
              <ListItemIcon>
                <Home />
              </ListItemIcon>
              <ListItemText primary="Home" />
            </ListItemButton>
              <ListItemButton component="a" href={`/auth/login?returnTo=${encodeURIComponent(baseUri)}`} onClick={toggleDrawer}  className={classes.loginOrLogoutButton}>
                <ListItemIcon>
                  <Login />
                </ListItemIcon>
                <ListItemText primary="Login" />
              </ListItemButton>
          </List>

    );
  }

  return (
    <div>
      <IconButton
        edge="start"
        aria-label="menu"
        sx={{ position: 'fixed', top: 15, left: 15, zIndex: 1201, color: theme.colors.menuButtonColor }}
        onClick={toggleDrawer}
      >
        <Menu />
      </IconButton> 
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer}>
        <div style={{ paddingTop: 64, paddingLeft: 16, paddingRight: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 16 }}>
            <img src="/logo.png" alt="App Logo" width="80" style={{ maxWidth: '100%' }} />
          </div>
      {isLoggedIn ? loggedInView() : loggedOutView()}
        </div>
      </Drawer>
    </div>
  );
}
