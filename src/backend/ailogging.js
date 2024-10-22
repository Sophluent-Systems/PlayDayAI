

export async function rateLLMResponse(db, sessionID, recordID, ratings) {
    console.error("rateLLMResponse: ", sessionID, " ", recordID, " ratings ",ratings);
    try {
        const coll = db.collection('records');
        const query = {
            recordID: recordID
        };
        let updateData = {
            ratings: ratings,
        }
        await coll.updateOne(query,{$set:  updateData});
        return updateData;
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    } 
}


export async function getLLMTrainingData(
    db,
    gameID,
    filters
    ) {

    try {
        const coll = db.collection('records');
        var query = {gameID: gameID};
        if (filters) {
            if (filters.versionID && filters.versionID.length > 0) {
                query['versionID'] = { $in: filters.versionID };
            }
            if (filters.requestType && filters.requestType.length > 0) {
                query['nodeInstanceID'] = { $in: filters.requestType };
            }
        }

        const cursor = await coll.find(query).sort({ createdTime: 1 });

        let list = await cursor.toArray();
        // remove _id from every item
        list = list.map((item) => {
            delete item._id;
            return item;
        });
        return list;
    } catch (error) {
        console.error('Error saving game session:', error);
        throw error;
    }
}
