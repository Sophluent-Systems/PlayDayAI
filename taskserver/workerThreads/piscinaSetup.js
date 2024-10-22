import Piscina from 'piscina';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uri = process.env.MONGODB_URL;
const options = {
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000
};

function createPiscina() {
  return new Piscina({
    filename: path.resolve(__dirname, 'taskWorker.js'),
    maxThreads: 10, // Adjust based on your needs
    workerData: { 
      mongoUri: uri,
      mongoOptions: options
    }
  });
}

export const piscina = createPiscina();
export default piscina;