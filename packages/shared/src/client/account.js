export async function callGetAccountInfo() {
    try {
        const response = await fetch(`/api/getaccountinfo`);
        const data = await response.json();
        if (response.status !== 200) {
            const errorMessage = data.error || `Request failed with status ${response.status}`;
            throw errorMessage;
        } else {
            return data;
        }
    } catch (error) {
        throw error;
    };
}


export async function callLookupAccount(email) {
  try {
      const response = await fetch(`/api/lookupaccount?email=${email}`);
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

export async function callUpdateAccountInfo(newAccountInfo) {
    try {
      // Make API call to update account information on the server
      const response = await fetch('/api/updateaccountinfo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({account: newAccountInfo}),
      });
  
      if (response.ok) {
        const data = await response.json();
        // Update the local cache with the new account information
        return data;
      } else {
        console.error('Error updating account information:', response.status);
        return null;
      }
    } catch (error) {
      console.error('Error updating account information:', error);
      return null;
    }
  }

  
