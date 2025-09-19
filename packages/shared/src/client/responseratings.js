


export async function callSubmitMessageRating(sessionID, recordID, playerRating, adminRating) {
    console.log("callSubmitMessageRating");

    let params = {
        sessionID: sessionID,
        recordID: recordID,
    };

    if (typeof playerRating !== "undefined") {
        params.playerRating = playerRating;
    }
    if (typeof adminRating !== "undefined") {
        params.adminRating = adminRating;
    }

    try {
        const response = await fetch("/api/rateresponse", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(params),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("callGetSaves: ", error);
        throw error;
    };
}

//req.body.gameID, req.body.versionsList, req.body.includeMessageHistory

export async function callGetTrainingData(gameID, filters) {
    console.log("callGetTrainingData");

    let params = {
        gameID: gameID,
        filters: filters,
    };

    try {
        const response = await fetch("/api/gettrainingdata", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(params),
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("callGetSaves: ", error);
        throw error;
    };

}
