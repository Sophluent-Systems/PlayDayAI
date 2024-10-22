import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Typography,
  Snackbar,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Divider,
  Box,
  Stack,
} from '@mui/material';
import { StandardContentArea } from '@src/client/components/standard/standardcontentarea';
import { RequireAuthentication } from '@src/client/components/standard/requireauthentication';
import { DefaultLayout } from '@src/client/components/standard/defaultlayout';
import { stateManager } from '@src/client/statemanager';
import {
  callSetAccountRoles,
  callgetAccountRolesAndBasicPermissions,
} from '@src/client/permissions';
import { useRouter } from 'next/router';
import { useConfig } from '@src/client/configprovider';
import { TwoColumnSelector } from '@src/client/components/standard/twocolumnselector';
import { SingleUserGameRoleEditor } from '@src/client/components/singleusergameroleeditor';
import { defaultGetServerSideProps } from '@src/client/prerender';

export default function Home() {
  const { Constants } = useConfig();
  const router = useRouter();
  const { loading, account, accountHasRole } = useContext(stateManager);
  
  const [email, setEmail] = useState("");
  const [validEmail, setValidEmail] = useState(false);
  const [rolesGranted, setRolesGranted] = useState([]);
  const [rolesAvailable, setRolesAvailable] = useState([]);
  const [originalRolesGranted, setOriginalRolesGranted] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameRoles, setGameRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!loading && account && !accountHasRole("admin")) {
      console.log("Not an admin");
      router.replace('/');
    }
  }, [loading, account, router]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (validateEmail(email)) {
        fetchRolesOnEmailChange();
      } else {
        setValidEmail(false);
        setRolesGranted([]);
        setRolesAvailable([]);
        setOriginalRolesGranted([]);
        setGameRoles([]);
        setSelectedGame(null);
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [email]);

  const validateEmail = (email) => {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    return regex.test(email);
  }

  const handleEmailChange = (event) => {
    setEmail(event.target.value);
  }

  const setNewRoleData = (userRoles, gameRolesData) => {
    setRolesGranted(userRoles);
    setOriginalRolesGranted(userRoles);
    const available = Constants.userRoles.filter(role => !userRoles.includes(role));
    setRolesAvailable(available);
    setGameRoles(Array.isArray(gameRolesData) ? gameRolesData : []);
    setHasChanges(false);
  }

  const fetchRolesOnEmailChange = async () => {
    setLoadingRoles(true);
    try {
      const roleData = await callgetAccountRolesAndBasicPermissions(null, email);
      setNewRoleData(roleData.userRoles, roleData.gameRoles);
      setValidEmail(true);
      setNotification({ open: true, message: 'Roles fetched successfully.', severity: 'success' });
    } catch (error) {
      console.error("Error fetching roles:", error);
      setValidEmail(false);
      setRolesGranted([]);
      setRolesAvailable([]);
      setOriginalRolesGranted([]);
      setGameRoles([]);
      setSelectedGame(null);
      setNotification({ open: true, message: 'Failed to fetch roles. Please check the email address.', severity: 'error' });
    } finally {
      setLoadingRoles(false);
    }
  }

  const handleUpdateRoles = async (rolesToAdd, rolesToRemove) => {
    setRolesGranted(prev => {
      const newRolesGranted = rolesToAdd 
        ? [...prev, ...rolesToAdd]
        : [...prev];
      return rolesToRemove
        ? newRolesGranted.filter(role => !rolesToRemove.includes(role))
        : newRolesGranted;
    });

    setRolesAvailable(prev => {
      const newRolesAvailable = rolesToRemove
        ? [...prev, ...rolesToRemove]
        : [...prev];
      return rolesToAdd
        ? newRolesAvailable.filter(role => !rolesToAdd.includes(role))
        : newRolesAvailable;
    });

    setHasChanges(true);

    return true; // Allow the move operation to proceed
  };

  const handleNotifyColumnsChanged = (columnA, columnB) => {
    // This function is no longer needed if TwoColumnSelector is fully controlled
    // You can remove this function and its usage if you refactor TwoColumnSelector
    setRolesGranted(columnA);
    setRolesAvailable(columnB);
  }

  const handleSave = () => {
    const rolesToAdd = rolesGranted.filter(role => !originalRolesGranted.includes(role));
    const rolesToRemove = originalRolesGranted.filter(role => !rolesGranted.includes(role));
    if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
      setConfirmDialogOpen(true);
    } else {
      setNotification({ open: true, message: 'No changes to save.', severity: 'info' });
    }
  }

  const handleReset = () => {
    setRolesGranted(originalRolesGranted);
    setRolesAvailable(Constants.userRoles.filter(role => !originalRolesGranted.includes(role)));
    setHasChanges(false);
  }

  const confirmRoleUpdate = async () => {
    setConfirmDialogOpen(false);
    setLoadingRoles(true);
    const rolesToAdd = rolesGranted.filter(role => !originalRolesGranted.includes(role));
    const rolesToRemove = originalRolesGranted.filter(role => !rolesGranted.includes(role));
    try {
      const roleData = await callSetAccountRoles(null, email, rolesToAdd, rolesToRemove);
      setNewRoleData(roleData.userRoles, roleData.gameRoles);
      setNotification({ open: true, message: 'Roles updated successfully.', severity: 'success' });
    } catch (error) {
      console.error("Error updating roles:", error);
      setNotification({ open: true, message: 'Failed to update roles.', severity: 'error' });
    } finally {
      setLoadingRoles(false);
    }
  }

  const cancelRoleUpdate = () => {
    setConfirmDialogOpen(false);
  }

  const handleCloseNotification = (event, reason) => {
    if (reason === 'clickaway') return;
    setNotification({ ...notification, open: false });
  }

  return (
    <RequireAuthentication>
      <DefaultLayout title="User Permissions (ADMIN)">
        <StandardContentArea>
          <Stack spacing={4} width="100%">
            {/* Email input section */}
            <Box>
              <Stack spacing={1}>
                <Typography variant="h6">Enter User Email</Typography>
                <Typography variant="body2" color="textSecondary">
                  Enter the email address of the user whose permissions you wish to modify.
                </Typography>
              </Stack>
              <TextField
                label="User Email"
                value={email}
                onChange={handleEmailChange}
                fullWidth
                helperText="e.g., user@example.com"
                error={email.length > 0 && !validEmail}
                placeholder="e.g., user@example.com"
                sx={{ mt: 1 }}
              />
              {email.length > 0 && !validEmail && (
                <Typography color="error" variant="body2" mt={1}>
                  Please enter a valid email address.
                </Typography>
              )}
            </Box>

            {loadingRoles && (
              <Box textAlign="center">
                <CircularProgress />
                <Typography variant="body2" mt={1}>Loading roles...</Typography>
              </Box>
            )}

            {validEmail && !loadingRoles && (
              <>
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'center',  flexDirection: 'column', padding: 5}}>
                  <Stack spacing={1}>
                    <Typography variant="h6">Manage User Roles</Typography>
                    <Typography variant="body2" color="textSecondary">
                      Modify the roles granted to the user by moving them between the two columns.
                    </Typography>
                  </Stack>
                  <Box mt={2} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <TwoColumnSelector
                        columnAlabel="Roles Granted"
                        columnAdata={rolesGranted || []}
                        columnBlabel="Roles Available"
                        columnBdata={rolesAvailable || []}
                        onAsynchronouslyMoveItems={handleUpdateRoles}
                        // onNotifyColumnsChanged={handleNotifyColumnsChanged} // Remove if refactored
                    />
                  </Box>
                  <Box mt={2} display="flex" justifyContent="flex-end">
                    <Button onClick={handleReset} sx={{ mr: 1 }} disabled={!hasChanges}>
                      Reset
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={!hasChanges}>
                      Save Changes
                    </Button>
                  </Box>
                </Box>

              </>
            )}
            </Stack>
          </StandardContentArea>

          <Dialog
            open={confirmDialogOpen}
            onClose={cancelRoleUpdate}
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-description"
          >
            <DialogTitle id="confirm-dialog-title">Confirm Role Update</DialogTitle>
            <DialogContent>
              <DialogContentText id="confirm-dialog-description">
                Are you sure you want to update the user's roles?
                <br />
                <strong>Roles to Add:</strong> {rolesGranted.filter(role => !originalRolesGranted.includes(role)).join(', ') || 'None'}
                <br />
                <strong>Roles to Remove:</strong> {originalRolesGranted.filter(role => !rolesGranted.includes(role)).join(', ') || 'None'}
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={cancelRoleUpdate} color="secondary">
                Cancel
              </Button>
              <Button onClick={confirmRoleUpdate} color="primary" autoFocus>
                Confirm
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={notification.open}
            autoHideDuration={6000}
            onClose={handleCloseNotification}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
              {notification.message}
            </Alert>
          </Snackbar>
        </DefaultLayout>
      </RequireAuthentication>
  );
}

export const getServerSideProps = defaultGetServerSideProps;
