import React, { useState, useEffect } from 'react';
import {
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Box,
  IconButton,
  TextField,
} from '@mui/material';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import DeleteIcon from '@mui/icons-material/Delete';
import { callSetGameSharingSettings, callSetGameRolesForAccount } from '@src/client/permissions';
import { useConfig } from '@src/client/configprovider';
import { stateManager } from '@src/client/statemanager';
import { nullUndefinedOrEmpty } from '../../common/objects';
import { callLookupAccount } from '@src/client/account';


const permissionOptions = {
  "game_player": {
    "label": "App user",
  },
  "game_sourceViewer": {
    "label": "Source code viewer",
  },
  "game_editor": {
    "label": "Editor",
  },
  "game_owner": {
    "label": "Owner",
  },
}


export const PermissionsEditor = (props) => {
  const { Constants } = useConfig();
  const { gameID, startingPermissions, onPermissionsChange } = props;
  const [permissions, setPermissions] = useState(startingPermissions);
  const [mode, setMode] = useState("topleveloptions");
  const [editing, setEditing] = useState(null);
  const [newEmail, setNewEmail] = useState("");
  const { account } = React.useContext(stateManager);

  const groupOptions = Object.keys(Constants.userRoleDisplayNames).filter(role => role != 'admin').map((role) => {
    return {
      value: role,
      label: Constants.userRoleDisplayNames[role],
    }
  });
  
  useEffect(() => {
    /*
      Format: 
        {
            "accounts": {
                "b599427b-7c16-48f6-8554-16b271bdb6c7": {
                    "roles": [
                        "game_owner"
                    ],
                    "email": "email@domain.com",
                    "authID": "authprovideer|123456789"
                }
            },
            "groups": {
                "roles": {
                    "game_owner": [
                        "admin"
                    ],
                    "game_editor": [],
                    "game_sourceViewer": [
                        "creator"
                    ],
                    "game_player": [
                        "consumer"
                    ]
                }
            }
        }

    */
    setPermissions(startingPermissions);
  }, [startingPermissions]);

  const updatePermissions = (newPermissions) => {
    setPermissions(newPermissions);
    onPermissionsChange(newPermissions);
  };

  const isMorePermissive = (existingGroup, newGroup) => {
    // look up the array index of both
    const groupIndex = groupOptions.findIndex((group) => group.value === existingGroup);
    const newGroupIndex = groupOptions.findIndex((group) => (newGroup && Array.isArray(newGroup)) && newGroup.includes(group.value));

    return newGroupIndex < groupIndex;
  }

  async function updateGroupPermissions(option, newGroup) {
    const newPermissions = { ...permissions };
    if (!newPermissions.groups.roles) {
      newPermissions.groups.roles = {};
    }
    newPermissions.groups.roles[option] = (newGroup != "individuals") ? [newGroup] : [];

    // Anyone who can edit can also view source
    // Anyone who can view source can also play
    // Anyone who can't play can't view source
    // Anyone who can't view source can't edit
    if (option === "game_editor") {
      // If a group other than "individuals" can edit, they can also view source and play
      if (newGroup !== "individuals") {
        if (isMorePermissive(newGroup, newPermissions.groups.roles.game_sourceViewer)) {
          newPermissions.groups.roles.game_sourceViewer = [newGroup];
        }
        if (isMorePermissive(newGroup, newPermissions.groups.roles.game_player)) {
          newPermissions.groups.roles.game_player = [newGroup];
        }
      }
    }

    if (option === "game_sourceViewer") {
      // If a group other than "individuals" can view source, they can also play
      if (newGroup !== "individuals") {
        if (isMorePermissive(newGroup, newPermissions.groups.roles.game_player)) {
          newPermissions.groups.roles.game_player = [newGroup];
        }
      }
      // If a group is "individuals" or less permissive than the current editor, they can't edit
      if (newGroup === "individuals" || isMorePermissive(newPermissions.groups.roles.game_editor, newGroup)) {
        newPermissions.groups.roles.game_editor = newGroup === "individuals" ? [] : [newGroup];
      }
    }

    if (option === "game_player") {
      // If a group is "individuals" or less permissive than the current source viewer, they can't view source
      if (newGroup === "individuals" || isMorePermissive(newPermissions.groups.roles.game_sourceViewer, newGroup)) {
        newPermissions.groups.roles.game_sourceViewer = newGroup === "individuals" ? [] : [newGroup];
      }
      // If a group is "individuals" or less permissive than the current editor, they can't edit
      if (newGroup === "individuals" || isMorePermissive(newPermissions.groups.roles.game_editor, newGroup)) {
        newPermissions.groups.roles.game_editor = newGroup === "individuals" ? [] : [newGroup];
      }
    }

    await callSetGameSharingSettings(gameID, newPermissions.groups);
    updatePermissions(newPermissions);
    onPermissionsChange(newPermissions);
  }


  const renderGroupDropdown = (optionValue) => {
      const option = permissionOptions[optionValue];
      const currentValue = permissions.groups?.roles?.[optionValue]?.[0] || "individuals";

      return  (
          <FormControl 
            sx={{ m: 1, minWidth: 120}}
            fullWidth 
          >
              <InputLabel >Groups</InputLabel>
              <Select
                value={currentValue}
                label={option.label}
                onChange={(e) => {
                  e.stopPropagation();
                  updateGroupPermissions(optionValue, e.target.value);
                }}
              >
                {groupOptions.map((group, index) => {
                  return <MenuItem value={group.value} key={group.value}>{group.label}</MenuItem>;
                })}
              </Select>
          </FormControl>
    );
  }

  const enterAccountEditMode = (permissions) => {
    setMode("accountpermissions");
    setEditing(permissions);
  }

  const topLevelPermissionsOptions = () => {
    return (
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>
              <Box sx={{flex: 1, flexDirection: 'column'}}>
                <Typography variant="body1">
                  Editors
                </Typography>
                <Typography variant="caption" sx={{ mt: -1, fontSize: '0.8em', color: 'text.secondary' }}>
                (edit, delete, view usage)
                </Typography>
              </Box>
            </TableCell>
            <TableCell align="center">{renderGroupDropdown("game_editor")}</TableCell>
            <TableCell align="center">
              <Button variant="outlined" onClick={(e) => enterAccountEditMode("game_editor")}>Edit users</Button>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>
              <Box sx={{flex: 1, flexDirection: 'column'}}>
                <Typography variant="body1">
                  Source code viewers
                </Typography>
                <Typography variant="caption" sx={{ mt: -1, fontSize: '0.8em', color: 'text.secondary' }}>
                  (view graph and settings)
                </Typography>
              </Box>
            </TableCell>
            <TableCell align="center">{renderGroupDropdown("game_sourceViewer")}</TableCell>
            <TableCell align="center">
              <Button variant="outlined" onClick={(e) => enterAccountEditMode("game_sourceViewer")}>Edit users</Button>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell>
              <Box sx={{flex: 1, flexDirection: 'column'}}>
                <Typography variant="body1">
                  App users
                </Typography>
                <Typography variant="caption" sx={{ mt: -1, fontSize: '0.8em', color: 'text.secondary' }}>
                (run the app only)
                </Typography>
              </Box>
            </TableCell>
            <TableCell align="center">{renderGroupDropdown("game_player")}</TableCell>
            <TableCell align="center">
              <Button variant="outlined" onClick={(e) => enterAccountEditMode("game_player")}>Edit users</Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  async function addEmail() {
    // Does the account already have permission?
    if (nullUndefinedOrEmpty(newEmail) || permissions.accounts[newEmail]) {
      return;
    }

    let accountInfo;
    try {
      accountInfo = await callLookupAccount(newEmail);
      
      if (!accountInfo) {
        alert("Account not found: " + newEmail);
        return;
      }

    } catch (error) {
      console.error("Error looking up account: ", error);
      alert("Error looking up account: " + error);
      return;
    }

    const newRole = "game_player";
    await callSetGameRolesForAccount(accountInfo.accountID, gameID, [newRole], [])

    const newPermissions = { ...permissions };
    newPermissions.accounts[accountInfo.accountID] = {
      roles: [newRole],
      email: newEmail,
    };
    updatePermissions(newPermissions);
    setNewEmail("");
  };

  async function deleteAccount(accountID) {
    const oldRole = permissions.accounts[accountID].roles?.[0];
    if (oldRole) {
      await callSetGameRolesForAccount(accountID, gameID, [], [oldRole])
    }
    const newPermissions = { ...permissions };
    delete newPermissions.accounts[accountID];
    updatePermissions(newPermissions);
  };

  async function updatePermission(accountID, newRole) {
    const newPermissions = { ...permissions };
    const oldRole = newPermissions.accounts[accountID].roles[0];
    if (oldRole != newRole) {
      newPermissions.accounts[accountID].roles = [newRole];
      await callSetGameRolesForAccount(accountID, gameID, [newRole], [oldRole])
      updatePermissions(newPermissions);
    }
  };

  const renderPermissionDropdown = (accountID) => {
    const currentRole = permissions.accounts[accountID].roles[0] || "game_player";
    return (
      <FormControl sx={{ m: 1, minWidth: 120 }} fullWidth>
        <InputLabel>Permission</InputLabel>
        <Select
          value={currentRole}
          label="Permission"
          onChange={(e) => updatePermission(accountID, e.target.value)}
          disabled={account.accountID == accountID}
        >
          {Object.keys(permissionOptions).map((role) => (
            <MenuItem value={role} key={role}>{permissionOptions[role].label}</MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const editAccountPermissions = () => {
    
    return (
      <Box>
        <IconButton
            onClick={() => {
              setMode("topleveloptions");
              setEditing(null);
            }}
          >
              <NavigateBeforeIcon />
          </IconButton>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Permission</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.keys(permissions.accounts).map((accountID) => (
              <TableRow key={accountID}>
                <TableCell>{permissions.accounts[accountID].email}</TableCell>
                <TableCell>{renderPermissionDropdown(accountID)}</TableCell>
                <TableCell>
                  <IconButton 
                     onClick={() => deleteAccount(accountID)}
                     disabled={account.accountID == accountID}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <TextField
            label="Add Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key == 'Enter' || e.code == 'NumpadEnter' || e.code == 'Enter') {
                addEmail();
              }
            }}
            sx={{ mr: 2 }}
          />
          <Button variant="contained" onClick={addEmail}>Add</Button>
        </Box>
      </Box>
    );
  }


  return (
    <Box
      sx={{minWidth: 550, minHeight: 280, display: 'flex', flexDirection: 'column'}}
    >
      {mode === 'topleveloptions' && topLevelPermissionsOptions()}
      {mode === 'accountpermissions' && editAccountPermissions()}
    </Box>
  );
};
