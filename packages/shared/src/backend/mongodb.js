import { MongoClient } from 'mongodb';
import { isMainThread, workerData } from 'worker_threads';

const uri = process.env.MONGODB_URL;

const options = {
  maxPoolSize: 10,  // Reduced for worker threads
  minPoolSize: 5,
  maxIdleTimeMS: 30000
};

let _client = null;
let _clientPromise = null;

export async function getMongoClient() {
  if (!_client) {
    _client = new MongoClient(isMainThread ? uri : workerData.mongoUri, 
                              isMainThread ? options : workerData.mongoOptions);
    _clientPromise = await _client.connect();
  }
  await _clientPromise;
  return _client;
}

export async function getMongoDb(dbName) {
  const client = await getMongoClient();
  return client.db(dbName);
}

export async function closeMongoConnection() {
  if (_client) {
    await _client.close();
    _client = null;
    _clientPromise = null;
  }
}