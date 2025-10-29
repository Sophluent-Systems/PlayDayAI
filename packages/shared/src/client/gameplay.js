
export async function callGetGamesList() {
    try {
      const response = await fetch('/api/listgames');
      if (response.ok) {
        const games = await response.json();
        return games;
      } else {
        console.error('Error fetching games:', response.status);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
      return [];
    }
  }

export async function callgetGameInfoByUrl(gameUrl, mode) {
    try {
        const response = await fetch(`/api/getgameinfo?game=${gameUrl}&mode=${mode}`);
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callgetGameInfoByUrl: ", error);
        return null;
    };
}


export async function callCreateNewGame(title, gameUrl) {
    console.log("callCreateNewGame");

    try {
        const response = await fetch("/api/createnewgame", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameUrl: gameUrl, title: title}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callCreateNewGame: ", error);
        throw error;
    };
}


export async function callUpdateGameInfo(gameInfo) {

    try {
        const response = await fetch("/api/updategameinfo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameInfo: gameInfo}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callSetGameInfo: ", error);
        throw error;
    };

}


export async function callGetSessionInfo(gameID, sessionID) {
  
    try {
        const response = await fetch("/api/getsessioninfo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({sessionID: sessionID, gameID: gameID}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callGetSessionInfo: ", error);
        throw error;
    };
  };



export async function callGetMostRecentSave(gameUrl, gameID, versionName) {
    
    try {
        var params = {};
        if (gameUrl) {
            params.gameUrl = gameUrl;
        }
        if (gameID) {
            params.gameID = gameID;
        }
        if (versionName) {
            params.versionName = versionName;
        }
        const response = await fetch("/api/getmostrecentsave", {
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
        console.error("callGetMostRecentSave: ", error);
        throw error;
    };
};



export async function callStartNewGame(url, version) {
    console.log("callStartNewGame");
  
    try {
        var params = {gameUrl: url}
        if (version) {
            params.versionName = version;
        }
        const response = await fetch("/api/startnewgame", {
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
        console.error("callStartNewGame: ", error);
        throw error;
    };
  };
  

export async function callDeleteGameSession(sessionID) {
    console.log("callDeleteGameSession ", sessionID);
  
    try {
        const response = await fetch("/api/deletesave", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({sessionID: sessionID}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return true;
        }
    } catch (error) {
        console.error("callDeleteGameSession: ", error);
        throw error;
    };
  };


export async function callStateMachineContinuationRequest(sessionID, params={}) {
    
    let paramsToSend = {
        sessionID: sessionID,
        requestType: "continuation",
        ...params
    };

    try {
          const response = await fetch("/api/statemachinerequest", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json"
              },
              body: JSON.stringify(paramsToSend),
              });
          const data = await response.json();
          return data;
      } catch (error) {
          console.error("callStateMachineContinuationRequest: ", error);
          throw error;
      };
  };


  export async function callStateMachineHaltRequest(sessionID, params={}) {
    console.log("callStateMachineHaltRequest");
    
    let paramsToSend = {
        sessionID: sessionID,
        requestType: "halt",
        ...params
    };

    console.log("callStateMachineHaltRequest: ", JSON.stringify(paramsToSend, null, 2));

    try {
          const response = await fetch("/api/statemachinerequest", {
              method: "POST",
              headers: {
                  "Content-Type": "application/json"
              },
              body: JSON.stringify(paramsToSend),
              });
          const data = await response.json();
          return data;
      } catch (error) {
          console.error("callStateMachineContinuationRequest: ", error);
          throw error;
      };
  };

export async function callRenameSession(gameID, sessionID, newAssignedName) {
    console.log("callRenameSession sessionID=", sessionID, " newAssignedName=", newAssignedName);

    try {
        const response = await fetch("/api/renamesession", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({gameID: gameID, sessionID: sessionID, newAssignedName: newAssignedName}),
            });
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            console.error("callRenameSession: ", errorMessage);
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callRenameSession: ", error);
        throw error;
    };
}
  
