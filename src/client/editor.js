import { Constants } from '@src/common/defaultconfig';

async function callGetAllSessionsForGame(gameID, versionID, accountID) {
    Constants.debug.logStateManager && console.log("callGetAllSessionsForGame gameID=", gameID, " versionID=", versionID, " accountID=", accountID);
  
    try {
        var params = {gameID: gameID};
        if (versionID) {
            params.versionID = versionID;
        }
        if (accountID) {
            params.accountID = accountID;
        }
        const response = await fetch("/api/getallsessionsforgame", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(params),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callGetAllSessionsForGame: ", error);
        throw error;
    };
  };


  async function callAddGameVersion(gameID, versionName, prototypeVersionName) {
    console.log("callAddGameVersion gameID=", gameID, " versionName=", versionName, " prototypeVersionName=", prototypeVersionName);
  
    try {
        var params = {gameID: gameID, versionName: versionName}
        if (prototypeVersionName) {
            params.prototypeVersionName = prototypeVersionName;
        }
        const response = await fetch("/api/addgameversion", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(params),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callAddGameVersion: ", error);
        throw error;
    };
  };

  async function callListGameVersions(gameID, gameUrl, onlyPublished) {  
    try {
        const response = await fetch("/api/listgameversions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: gameID, gameUrl: gameUrl, onlyPublished: onlyPublished}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        throw error;
    };
  };

  async function callGetVersionInfoForEdit(gameID, versionName) {  
    try {
        const response = await fetch("/api/getversioninfoforedit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: gameID, versionName: versionName}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callGetVersionInfoForEdit: ", error);
        throw error;
    };
  };

  
  async function callReplaceAppVersion(versionInfo) {
    console.log("callReplaceAppVersion versionName=", versionInfo.versionName);
  
    try {
        const response = await fetch("/api/replaceappversion", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: versionInfo.gameID, versionName: versionInfo.versionName, updatedFields: versionInfo}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callReplaceAppVersion: ", error);
        throw error;
    };
  };


  
  async function callDeleteGameAndAllData(gameID) {
    console.log("callDeleteGameAndAllData");
  
    try {
        const response = await fetch("/api/deletegame", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: gameID}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callDeleteGameAndAllData: ", error);
        throw error;
    };
  };

  async function callDeleteGameVersion(gameID, versionName) {
    console.log("callDeleteGameVersion");
  
    try {
        const response = await fetch("/api/deletegameversion", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: gameID, versionName: versionName}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callDeleteGameVersion: ", error);
        throw error;
    };
  };


async function callRetryRecord(sessionID, startingRecordID, singleStep = false) {
    console.log("callRetryRecord");
  
    try {
        const response = await fetch("/api/retryrecord", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({sessionID: sessionID,startingRecordID: startingRecordID, singleStep: singleStep }),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callRetryRecord: ", error);
        throw error;
    };
  };



async function callGetRecordResultField(sessionID, recordID, field) {
    console.log("callGetRecordResultField index=", recordID, field);
  
    try {
        const response = await fetch("/api/debuggerresponseinfo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({sessionID: sessionID,recordID: recordID, field: field}),
            });
        const data = await response.json();
        return data.value;
    } catch (error) {
        console.error("callGetRecordResultField: ", error);
        throw error;
    };
  };


async function callCloneSession(gameID, sessionID) {
    console.log("callCloneSession sessionID=", sessionID);

    try {
        const response = await fetch("/api/clonesession", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: gameID, sessionID: sessionID}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            console.error("callCloneSession: ", errorMessage);
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callCloneSession: ", error);
        throw error;
    };
}

async function callGetMessageHistorySnapshot(gameID, sessionID) {
    console.log("callGetMessageHistorySnapshot ", gameID, sessionID);
  
    try {
        const response = await fetch("/api/getmessagehistorysnapshot", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID, sessionID}),
            });
            const data = await response.json();
            if (response.status !== 200) {
                const errorMessage = data.error || `Request failed with status ${response.status}`;
                console.error("callCloneSession: ", errorMessage);
                throw errorMessage;
            } else {
                return data;
            }
    } catch (error) {
        console.error("callGetMessageHistorySnapshot: ", error);
        throw error;
    };
  };

export {
    callGetAllSessionsForGame,
    callAddGameVersion,
    callListGameVersions,
    callGetVersionInfoForEdit,
    callReplaceAppVersion,
    callDeleteGameVersion,
    callDeleteGameAndAllData,
    callRetryRecord,
    callGetRecordResultField,
    callCloneSession,
    callGetMessageHistorySnapshot,
}