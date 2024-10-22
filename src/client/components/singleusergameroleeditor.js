import React, { useState, useEffect } from 'react';
import {
    Box,
} from '@mui/material';
import { TwoColumnSelector } from './standard/twocolumnselector';
import { useConfig } from '@src/client/configprovider';
import { callSetGameRolesForAccount } from '@src/client/permissions';

export function SingleUserGameRoleEditor(params) {
    const { Constants } = useConfig();
    const { accountID, email, gameID, gameRoles } = params;
    const [rolesGranted, setAccountRolesGranted] = useState([]);
    const [rolesAvailable, setAccountRolesAvailable] = useState([]);

    function setNewRoleData(gameRoles) {

        console.log("setNewRoleData: ", gameRoles)

        // Fetch the user roles logic here
        // For demo purposes, let's assume the fetched roles
        setAccountRolesGranted(gameRoles);
  
        // roles available should be all roles minus the granted roles
        // from Constants
        const rolesAvailable = Constants.gameRoles.filter(role => !gameRoles.includes(role));
        setAccountRolesAvailable(rolesAvailable);
    }
  
    useEffect(() => {
        if (gameRoles) {
            setNewRoleData(gameRoles);
        }
    }, [gameRoles]);

    async function onRequestMoveRoles(rolesToRemove, rolesToAdd) {
        try {
          const roleData = await callSetGameRolesForAccount(accountID, email, gameID, rolesToAdd, rolesToRemove);
          return true;
        } catch (error) {
          console.error("Error: ", error);
          return false;
        }
      }

    return (
        <Box>
            {gameRoles &&
                <TwoColumnSelector
                    columnAlabel="Roles Granted"
                    columnAdata={rolesGranted}
                    columnBlabel="Roles Available"
                    columnBdata={rolesAvailable}
                    onAsynchronouslyMoveItems={onRequestMoveRoles}  // Ensure onRequestMoveRoles function exists in this component or passed down via props.
                />
            }
        </Box>
    );
}
