
export async function callGetBlob(sessionID, blobID) {
    console.log("callGetBlob sessionID=", sessionID, "blobID=", blobID);

    const request = {
        sessionID: sessionID,
        blobID: blobID
    }

    try {
        const response = await fetch("/api/getblob", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(request),
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
        console.error("callGetBlob: ", error);
        throw error;
    };

}


export async function callUploadBlob(file, fileName = null) {
    console.log("callUploadBlobfile fileName=", fileName);

    if (!(file instanceof File)) {
        throw "Invalid File object";
    }
    
    const mimeType = file.type;
    let type = mimeType.split('/')[0];

    if (type !== 'audio' && type !== 'image' && type !== 'video' && type !== 'text') {
        type = 'data';
    }

    const formData = new FormData();    
    formData.append('file', file, fileName || `${type}.${mimeType.split('/')[1]}`); 

    try {
        const response = await fetch("/api/uploadblob", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            console.error("callUploadBlob: ", errorMessage);
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        console.error("callUploadBlob: ", error);
        throw error;
    }
}
