import React, { useState, useEffect } from 'react';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { stateManager } from '@src/client/statemanager';
import { useRouter } from 'next/router';
import { useConfig } from '@src/client/configprovider';
import { defaultGetServerSideProps } from '@src/client/prerender';
import { Button, Typography, Box, ToggleButtonGroup, ToggleButton, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Grid2 as Grid,
  Paper,
 } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import GroupIcon from '@mui/icons-material/Group';
import PublicIcon from '@mui/icons-material/Public';
import { callGetSiteRoleAccess, callSetCoarseSiteRoleAccess } from '@src/client/permissions';

export default function Home(props) {
  const { Constants } = useConfig();
  const router = useRouter();
  const { loading, account, accountHasRole } = React.useContext(stateManager);
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [accessControl, setAccessControl] = useState('invite-apps');
  const [openDialog, setOpenDialog] = useState(false);
  const [tempAccessControl, setTempAccessControl] = useState(null);
  const [hoveredOption, setHoveredOption] = useState(null);

  async function populateCurrentPermissions() {
    setLoadingPermissions(true);
    const siteAccess = await callGetSiteRoleAccess();
    console.log("newSiteRoleAccess", siteAccess);
    // Set the initial access control based on the siteAccess data
    // This is a placeholder logic, adjust according to your actual data structure
    if (siteAccess.guest.includes('service_editMode')) {
      setAccessControl('open');
    } else if (siteAccess.guest.includes('service_basicAccess')) {
      setAccessControl('invite-apps');
    } else {
      setAccessControl('invite-only');
    }
    setLoadingPermissions(false);
  }

  useEffect(() => {
    populateCurrentPermissions();
  }, []);

  useEffect(() => {
    if (!loading && !accountHasRole("admin")) {
      console.log("Not an admin");
      router.replace('/');
    }
  }, [loading, account]);

  const handleAccessControlChange = (newAccessControl) => {
    setTempAccessControl(newAccessControl);
    setOpenDialog(true);
  };

  const confirmAccessControlChange = async () => {
    setAccessControl(tempAccessControl);
    setOpenDialog(false);
    console.log("Setting access control to: ", tempAccessControl);
    await callSetCoarseSiteRoleAccess(tempAccessControl);
  };

  
  const accessOptions = [
    'invite-only',
    'invite-apps',
    'open',
  ];

  const accessDescriptions = {
    'invite-only': {
      label: 'Invite Only',
      description: "Only invited users can access any part of the site.",
      icon: LockIcon,
    },
    'invite-apps': {
      label: 'Invites for Creators',
      description: "Anyone can view the site, but only invited users can create apps.",
      icon: GroupIcon,
    },
    'open': {
      label: 'No Invite Required',
      description: "The site is completely open. Anyone can view and create apps.",
      icon: PublicIcon,
    },
  }

  const renderIcon = (option) => {
    const Icon = accessDescriptions[option].icon;
    return <Icon sx={{ fontSize: 64, mb: 2, color: accessControl === option ? 'primary.contrastText' : 'text.primary' }} />
  }

  return (
    
    <RequireAuthentication>
      <DefaultLayout title="User permissions (ADMIN)">
        <StandardContentArea>
          <Typography variant="h4" gutterBottom>
            Site Access Control
          </Typography>
          {loadingPermissions ? (
            <Typography>Loading permissions...</Typography>
          ) : (
            <Box sx={{ mt: 8 }}>
              <Grid container spacing={3} justifyContent="center">
                {accessOptions.map((option) => (
                  <Grid xs={12} sm={4} key={option}>
                    <Paper
                      elevation={accessControl === option ? 8 : 1}
                      sx={{
                        p: 3,
                        height: '100%',
                        width: '300px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        bgcolor: accessControl === option ? 'primary.light' : 'background.paper',
                        '&:hover': {
                          bgcolor: accessControl === option ? 'primary.light' : 'action.hover',
                        },
                      }}
                      onClick={() => handleAccessControlChange(option)}
                      onMouseEnter={() => setHoveredOption(option)}
                      onMouseLeave={() => setHoveredOption(null)}
                    >
                     {renderIcon(option)}

                      <Typography
                        variant="h6"
                        align="center"
                        sx={{
                          color: accessControl === option ? 'primary.contrastText' : 'text.primary',
                        }}
                      >
                        {accessDescriptions[option].label}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="body1" sx={{ mt: 4, textAlign: 'center', minHeight: '3em' }}>
                {hoveredOption
                  ? `${accessDescriptions[hoveredOption].label}: ${accessDescriptions[hoveredOption].description}`
                  : `Current setting: ${accessDescriptions[accessControl].label}: ${accessDescriptions[accessControl].description}`}
              </Typography>
            </Box>
          )}
        </StandardContentArea>
      </DefaultLayout>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {"Warning: Changing Site Access"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            You are about to change the site access to: {accessDescriptions[tempAccessControl]?.label}
            <br /><br />
            This may add access for many people or deny access to those who previously had it. Are you sure you want to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={confirmAccessControlChange} autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </RequireAuthentication>
  );
}

export const getServerSideProps = defaultGetServerSideProps;