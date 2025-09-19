

export async function callLookupCodes(showCodes=false) {
    console.log("callLookupCodes");

    try {
        const result = await fetch("/api/codemanage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({action: "lookupcodes", revealCodes: showCodes}),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return response.codes;
        }
    } catch (error) {
        console.error("callLookupCodes: ", error);
        throw error;
    };
}

export async function callGetAccessRequests(filter=null) {
    console.log("callGetAccessRequests");

    let parameters = {
        action: "getaccessrequests",
    };

    if (filter) {
        parameters.requestfilter = filter;
    }

    try {
        const result = await fetch("/api/codemanage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(parameters),
        });
        const response = await result.json();
        return response;
    } catch (error) {
        console.error("callGetAccessRequests: ", error);
        throw error;
    };
}

export async function callGenerateCode(purpose, notes, accountID, expiration) {
    console.log("callGenerateCode");
    let params = {
        action: "generatecode",
        purpose: purpose,
    };
    if (accountID) {
        params.accountID = accountID;
    }
    if (expiration) {
        params.expiration = expiration;
    }
    if (notes) {
        params.notes = notes;
    }
    try {
        const result = await fetch("/api/codemanage", {
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
            return response.code;
        }
    } catch (error) {
        console.error("callGenerateCode: ", error);
        throw error;
    };
}

export async function callDenyCodeRequest(accountID) {
    console.log("callDenyCodeRequest");
    let params = {
        action: "denyaccessrequest",
        accountID: accountID,
    };
    try {
        const result = await fetch("/api/codemanage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
        });
        const response = await result.json();
        return response;
    } catch (error) {
        console.error("callDenyCodeRequest: ", error);
        throw error;
    };
}

export async function callRedeemCode(codeToUse) {
    console.log("callRedeemCode");
    try {
        const result = await fetch("/api/coderedeem", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({code: codeToUse}),
        });
        const response = await result.json();
        return response;
    } catch (error) {
        console.error("callRedeemCode: ", error);
        throw error;
    };
}



export async function callDeleteCode(codeToDelete) {
    console.log("callDeleteCode");
    try {
        const result = await fetch("/api/codemanage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({action: "deletecode", code: codeToDelete}),
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return true;
        }
    } catch (error) {
        console.error("callDeleteCode: ", error);
        throw error;
    };
}
