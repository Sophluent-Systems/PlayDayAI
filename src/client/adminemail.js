export async function getEmailTemplate(templateName) {
    console.log("getEmailTemplate");

    try {
        const result = await fetch("/api/adminemail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "getemailtemplate", templateName: templateName })
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        return response.template;
    } catch (error) {
        console.error("getEmailTemplate: ", error);
        throw error;
    }
}

export async function setEmailTemplate(templateName, template) {
    console.log("setEmailTemplate");

    try {
        const result = await fetch("/api/adminemail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "setemailtemplate", templateName: templateName, template: template })
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        return true; // Assuming we just need to know if it was successful
    } catch (error) {
        console.error("setEmailTemplate: ", error);
        throw error;
    }
}


export async function sendAdminEmail(emailDetails) {
    console.log("sendAdminEmail");

    try {
        const result = await fetch("/api/adminemail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action: "sendemail", ...emailDetails })
        });
        const response = await result.json();
        if (response.status !== "success") {
            const errorMessage = response.error || `Request failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        return true; // Assuming we just need to know if it was successful
    } catch (error) {
        console.error("sendAdminEmail: ", error);
        throw error;
    }
}
