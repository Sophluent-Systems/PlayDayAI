import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SingleUserGameRoleEditor } from "./singleusergameroleeditor";
import { callGetGamePermissionsForEditing } from "@src/client/permissions";

export function AddAndEditGameUsers({ gameID }) {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [roleData, setRoleData] = useState({});
  const [manualEmailEntry, setManualEmailEntry] = useState(false);
  const [email, setEmail] = useState("");
  const [individualRolesGranted, setIndividualRolesGranted] = useState([]);

  const accountOptions = useMemo(() => Object.keys(roleData ?? {}), [roleData]);

  useEffect(() => {
    if (!gameID) {
      return;
    }

    const fetchRoles = async () => {
      try {
        const response = await callGetGamePermissionsForEditing(gameID);
        setRoleData(response ?? {});
      } catch (error) {
        console.error("Failed to load game permissions", error);
      }
    };

    fetchRoles();
  }, [gameID]);

  const validateEmail = useCallback((candidate) => {
    const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(candidate ?? "");
  }, []);

  const resolveSelectedRoles = useCallback(() => {
    let rolesGranted = [];

    if (manualEmailEntry && validateEmail(email)) {
      for (const accountID of accountOptions) {
        if (roleData[accountID]?.email === email) {
          rolesGranted = roleData[accountID]?.roles ?? [];
          break;
        }
      }
    } else if (selectedAccount) {
      rolesGranted = roleData[selectedAccount]?.roles ?? [];
    }

    setIndividualRolesGranted(rolesGranted ?? []);
  }, [accountOptions, email, manualEmailEntry, roleData, selectedAccount, validateEmail]);

  useEffect(() => {
    if (selectedAccount || (manualEmailEntry && validateEmail(email))) {
      resolveSelectedRoles();
    }
  }, [selectedAccount, email, manualEmailEntry, validateEmail, resolveSelectedRoles]);

  const handleDropdownChange = (event) => {
    const value = event.target.value;
    if (value === "manual-entry") {
      setManualEmailEntry(true);
      setSelectedAccount(null);
    } else {
      setManualEmailEntry(false);
      setEmail("");
      setSelectedAccount(value || null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
        <span>Select account</span>
        <select
          value={manualEmailEntry ? "manual-entry" : selectedAccount ?? ""}
          onChange={handleDropdownChange}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
        >
          <option value="" disabled>
            Choose an account
          </option>
          {accountOptions.map((accountID) => (
            <option key={accountID} value={accountID}>
              {roleData[accountID]?.email ?? accountID}
            </option>
          ))}
          <option value="manual-entry">Enter email manually</option>
        </select>
      </label>

      {manualEmailEntry ? (
        <label className="flex flex-col gap-2 text-sm font-semibold text-emphasis">
          <span>Enter email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-2xl border border-border bg-surface px-4 py-2 text-sm text-emphasis shadow-inner focus:border-primary focus:outline-none"
          />
        </label>
      ) : null}

      <SingleUserGameRoleEditor
        accountID={selectedAccount}
        email={manualEmailEntry ? email : roleData[selectedAccount]?.email}
        gameID={gameID}
        gameRoles={individualRolesGranted}
      />
    </div>
  );
}
