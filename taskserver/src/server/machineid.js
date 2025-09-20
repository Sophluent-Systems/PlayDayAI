import os from 'os';

export async function getMachineIdentifier() {
  return os.hostname(); // Local system's hostname
}
