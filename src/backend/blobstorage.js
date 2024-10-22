import { v4 as uuidv4 } from 'uuid';


export async function addBlobToStorage(db, base64Data, type, mimeType, accountID, sessionID) {
    const blobID = uuidv4();
    const coll = db.collection('blobs');
    await coll.updateOne(
        {blobID: blobID},
        {$set: {
            blobID: blobID,
            data: base64Data,
            type: type,
            mimeType: mimeType,
            accountID: accountID,
            sessionID: sessionID,
            format: 'base64',
            creationDate: new Date(),
        }},
        {upsert: true}
    );

    return blobID;
}

export async function getBlobFromStorage(db, blobID) {
    const coll = db.collection('blobs');
    const document = await coll.findOne({ blobID: blobID });
    if (!document) {
        return null;
    }
    delete document._id;
    return document;
}