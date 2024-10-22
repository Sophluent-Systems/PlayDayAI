import { Config } from "@src/backend/config";

export async function handleNodeFetchBlockingResponse(response) {
    const { Constants } = Config;
    return new Promise((resolve, reject) => {
          response.json().then((data) => {
            Constants.debug.logAICalls && console.log("handleNodeFetchBlockingResponse succeeded");
            
            // Extract the message content and resolve it
            resolve(data);
          }).catch((error) => {
            reject(error);
          });
      });
}
