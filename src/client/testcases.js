

async function callGetAllTestCasesForGame(gameID) {
    console.log("callGetAllTestCasesForGame");
  
    try {
        const response = await fetch("/api/getfullsessioninfo", {
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
            return data;
        }
    } catch (error) {
        console.error("callGetTestCaseList: ", error);
        throw error;
    };
  };


async function callGetTestCaseDetails(testCaseID) {
    console.log("callGetTestCaseDetails");
  
    try {
        const response = await fetch("/api/getfullsessioninfo", {
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
            return data;
        }
    } catch (error) {
        console.error("callGetTestCaseDetails: ", error);
        throw error;
    };
  };


  export {
    callGetAllTestCasesForGame,
    callGetTestCaseDetails,
}