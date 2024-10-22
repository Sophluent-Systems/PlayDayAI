import http from 'http';
import os from 'os';

async function fetchEC2InstanceId() {
  const url = 'http://169.254.169.254/latest/meta-data/instance-id';

  try {
    const response = await fetch(url, { timeout: 1000 }); // Setting the timeout
    if (!response.ok) {
      // Not a valid response, treat as non-EC2
      throw new Error('Response was not ok');
    }

    const data = await response.text();
    return data; // Return the instance ID
  } catch (error) {
    // Error handling, likely not EC2 or a fetch issue
    console.error('Failed to fetch EC2 instance ID:', error.message);
    return null; // Indicate an error or non-EC2
  }
}

export async function getMachineIdentifier() {
  return os.hostname(); // Local system's hostname
}
