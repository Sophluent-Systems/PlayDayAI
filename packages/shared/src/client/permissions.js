

export async function callInitACLSystem() {
    console.log("callInitACLSystem");

    try {
        const response = await fetch("/api/modifypermissions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({action: "init"}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callInitACLSystem: ", error);
        throw error;
    };
}

export async function callGetACLGameAccess(accountID, gameID, accessLevel) {
    console.log("callGetACLGameAccess");

    try {
        const result = await fetch("/api/modifypermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({action: "gameaccess", accountID: accountID, gameID: gameID, accessLevel: accessLevel}),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callGetACLGameAccess: ", error);
        throw error;
    };
}

export async function callgetAccountRolesAndBasicPermissions(accountID, email) {
    console.log("callgetAccountRolesAndBasicPermissions");

    try {
        const result = await fetch("/api/getpermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({action: "getAccountRolesAndBasicPermissions", accountID: accountID, email: email}),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        throw error;
    };
}

export async function callSetAccountRoles(accountID, email, rolesToAdd=[], rolesToRemove=[]) {
    console.log("callSetAccountRoles");

    let params = { action: "setaccountroles"};
    if (accountID) {
        params.accountID = accountID;
    }
    if (email) {
        params.email = email;
    }
    if (rolesToAdd) {
        params.rolesToAdd = rolesToAdd;
    }
    if (rolesToRemove) {
        params.rolesToRemove = rolesToRemove;
    }

    try {
        const result = await fetch("/api/modifypermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callSetAccountRoles: ", error);
        throw error;
    };
}



export async function callGetGamePermissionsForEditing(gameID) {

    try {
        const result = await fetch("/api/getpermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({action: "getgamepermissionsforediting", gameID: gameID}),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        throw error;
    };
}

export async function callGetAccountPermissionsForGame(accountID, gameID, gameUrl=null) {
    try {
        let params = {action: "getgamerightsforuser", accountID: accountID};
        if (gameID) {
            params.gameID = gameID;
        }
        if (gameUrl) {
            params.gameUrl = gameUrl;
        }
        const result = await fetch("/api/getpermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        throw error;
    };

}

export async function callSetGameSharingSettings( gameID, groups) {
    console.log("callSetGameSharingSettings gameID=", gameID, " groups=", groups);

    let params = { action: "setgamegroupsharingsettings"};
    params.gameID = gameID;
    params.groups = groups;

    try {
        const result = await fetch("/api/modifypermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callSetGameSharingSettings: ", error);
        throw error;
    };
}

export async function callSetGameRolesForAccount(accountID, gameID, rolesToAdd=[], rolesToRemove=[]) {
    console.log("callSetGameRolesForAccount");

    let params = { action: "setgamerolesforaccount"};
    params.accountID = accountID;
    params.gameID = gameID;
    params.rolesToAdd = rolesToAdd;
    params.rolesToRemove = rolesToRemove;
    
    try {
        const result = await fetch("/api/modifypermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callSetGameRolesForAccount: ", error);
        throw error;
    };
}

export async function callGetSiteRoleAccess() {
    
    let params = { action: "getsiteroleaccess"};
    try {
        const result = await fetch("/api/adminaccesscontrol", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callGetACLGameAccess: ", error);
        throw error;
    };
}

export async function callSetCoarseSiteRoleAccess( accessMode ) {

    let params = { 
        action: "setcoarsesiteroleaccess",
        accessMode: accessMode
    };

    try {
        
        const result = await fetch("/api/adminaccesscontrol", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    }
    catch (error) {
        console.error("callSetCoarseSiteRoleAccess: ", error);
        throw error;
    };
}


export async function callOneTimeSpecialAccessControlAction() {
    
    let params = { action: "onetimespecialaction"};
    try {
        const result = await fetch("/api/modifypermissions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.data;
        }
    } catch (error) {
        console.error("callGetACLGameAccess: ", error);
        throw error;
    };
}

