import React, { useEffect, useState } from "react";
import { TwoColumnSelector } from "./standard/twocolumnselector";
import { useConfig } from "@src/client/configprovider";
import { callSetGameRolesForAccount } from "@src/client/permissions";

export function SingleUserGameRoleEditor({ accountID, email, gameID, gameRoles = [] }) {
  const { Constants } = useConfig();
  const [rolesGranted, setAccountRolesGranted] = useState([]);
  const [rolesAvailable, setAccountRolesAvailable] = useState([]);

  const setNewRoleData = (grantedRoles = []) => {
    const normalizedRoles = Array.isArray(grantedRoles) ? grantedRoles : [];
    setAccountRolesGranted(normalizedRoles);

    const availableRoles = (Constants?.gameRoles ?? []).filter((role) => !normalizedRoles.includes(role));
    setAccountRolesAvailable(availableRoles);
  };

  useEffect(() => {
    setNewRoleData(gameRoles);
  }, [gameRoles]);

  const onRequestMoveRoles = async (rolesToRemove, rolesToAdd) => {
    try {
      await callSetGameRolesForAccount(accountID, email, gameID, rolesToAdd, rolesToRemove);
      return true;
    } catch (error) {
      console.error("Failed to update game roles", error);
      return false;
    }
  };

  if (!gameRoles) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <TwoColumnSelector
        columnAlabel="Roles Granted"
        columnAdata={rolesGranted}
        columnBlabel="Roles Available"
        columnBdata={rolesAvailable}
        onAsynchronouslyMoveItems={onRequestMoveRoles}
      />
    </div>
  );
}
