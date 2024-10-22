import { v4 as uuidv4 } from 'uuid';


export async function addCode(db, grants, optionalParams) {
  try {
    const coll = db.collection('codes');
    const date = new Date();
    const newCode = {
      code: uuidv4(),
      creationDate: date,
      redeemed: false,
      grants: grants,
      expiration: optionalParams.expiration || null,
      accountID: optionalParams.accountID || null,
      notes: optionalParams.notes || null,
    }
    await coll.insertOne(newCode);
    return newCode;
  } catch (error) {
      console.error('Error adding new code:', error);
      throw error;
  } 
}



export async function redeemCode(db, code, accountID) {
  try {
      const coll = db.collection('codes');
      const document = await coll.findOne({ code: code });
      if (!document) {
          return { status: 'not_found'};
      }
      if (document.redeemed) {
          return { status: 'already_redeemed' };
      }
      if (document.accountID && document.accountID != accountID) {
          return { status: 'wrong_account' };
      }
      if (document.expiration && document.expiration < new Date()) {
          return { status: 'expired' };
      }
      await coll.updateOne({ code: code }, { $set: { redeemed: true, accountID: accountID, redemptionDate: new Date() } });
      delete document._id;
      return { status: 'success', code: document };
  } catch (error) {
      console.error('Error looking up code:', error);
      throw error;
  } 
}

export async function lookupCodes(db, hideCodes, searchFields = {}) {
    try {
        const coll = db.collection('codes');
        const query = {...searchFields}
        const documents = await coll.find(query).sort({ creationDate: -1 }).toArray();
        // delete all _id fields
        documents.forEach((document) => {
            delete document._id;
            if (hideCodes) {
                delete document.code;
            }
        });
        return documents;
    } catch (error) {
        console.error('Error looking up codes: ', error);
        throw error;
    } 
}

export async function deleteCode(db, code) {
    try {
        const coll = db.collection('codes');
        const result = await coll.deleteOne({ code: code });
        return true;
    } catch (error) {
        console.error('Error deleting code: ', error);
        throw error;
    } 
}

