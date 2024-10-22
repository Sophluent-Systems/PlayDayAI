import React, { useState, useEffect } from "react";
import {
  Box, Select, MenuItem, FormControl, InputLabel, TextField
} from "@mui/material";
import { SingleUserGameRoleEditor } from "./singleusergameroleeditor";
import { callGetGamePermissionsForEditing } from "@src/client/permissions";

export function AddAndEditGameUsers(params) {
    const { gameID } = params;
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [roleData, setRoleData] = useState([]); // [ { accountID: "123", access: "game_owner", ... }
    const [manualEmailEntry, setManualEmailEntry] = useState(false);
    const [email, setEmail] = useState("");
    const [individualRolesGranted, setIndividualRolesGranted] = useState([]);

    useEffect(() => {
        if (gameID) {
            fetchRolesOnGameChange();
        }
    }, [gameID]);

    useEffect(() => {
      if (selectedAccount || (manualEmailEntry && validateEmail(email))) {
          onAccountSelected();
      }
    }, [selectedAccount, email]);

    async function fetchRolesOnGameChange() {
          try {
              let newRoleData = await callGetGamePermissionsForEditing(gameID);
              console.log("game role data: ", newRoleData);
              setRoleData(newRoleData);
          } catch (error) {
              console.error(error);
          }
    }
    
    async function onAccountSelected() {
      let rolesGranted = null;
      if (manualEmailEntry && validateEmail(email)) {

        console.log("selectedAccount: ", email, roleData)
        // check and see if this account is actually in the data we have
        const accounts = Object.keys(roleData); 
        for (let i = 0; i < accounts.length; i++) {
          console.log("roleData[i].email: ", roleData[accounts[i]].email, email)
          if (roleData[accounts[i]].email == email) {
            rolesGranted = roleData[accounts[i]].roles;
            break;
          }
        }

        if (!rolesGranted) {
          rolesGranted = [];
        }

      } else if (selectedAccount) {
        console.log("selectedAccount: ", selectedAccount)
        try {
          rolesGranted = roleData[selectedAccount]?.roles ? roleData[selectedAccount].roles : [];
        } catch (error) {
            console.error(error);
        }
      }

      console.log("rolesGranted: ", rolesGranted)

      setIndividualRolesGranted(rolesGranted);
  }

    const validateEmail = (email) => {
        const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return regex.test(email);
    };

    const handleDropdownChange = (event) => {
        const value = event.target.value;
        if (value === "manual-entry") {
            setManualEmailEntry(true);
            setSelectedAccount(null);
        } else {
            setEmail("");
            setManualEmailEntry(false);
            setSelectedAccount(value);
        }
    };

    return (
      <Box sx={{dispay: 'flex', flexGrow: 1, flexDirection: 'column', justifyContent:'center', alignContent: 'center'}}>
        <FormControl sx={{width:400}}>
          <InputLabel id="account-select-label">Select Account</InputLabel>
          <Select
            labelId="account-select-label"
            onChange={handleDropdownChange}
            value={manualEmailEntry ? "manual-entry" : selectedAccount}
          >
            {Object.keys(roleData).map(accountID => (
              <MenuItem key={accountID} value={accountID}>
                {roleData[accountID].email}
              </MenuItem>
            ))}
            <MenuItem value="manual-entry">Enter email manually</MenuItem>
          </Select>
        </FormControl>

        {manualEmailEntry && (
          <TextField
            label="Enter Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            margin="normal"
          />
        )}

        {roleData &&
              <SingleUserGameRoleEditor 
                  accountID={selectedAccount}
                  email={email}
                  gameID={gameID}
                  gameRoles={individualRolesGranted}
              />
        }
      </Box>
    );
}
