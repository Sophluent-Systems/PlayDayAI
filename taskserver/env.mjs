import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const projectRoot = process.cwd();
const nodeEnv = process.env.NODE_ENV || 'development';
const isTestEnv = nodeEnv === 'test';

const envSpecificFile = '.env.' + nodeEnv;
const envSpecificLocalFile = envSpecificFile + '.local';

const candidateFiles = [
  '.env',
  envSpecificFile,
  !isTestEnv ? '.env.local' : null,
  envSpecificLocalFile,
].filter(Boolean);

const loadedEnvFiles = [];

let root = projectRoot;
const possibleNames = [envSpecificLocalFile, envSpecificFile, '.env.local', '.env'];
while (true) {
  const hasMatch = possibleNames.some(name => name && fs.existsSync(path.join(root, name)));
  if (hasMatch) {
    break;
  }
  const parent = path.dirname(root);
  if (parent === root) {
    break;
  }
  root = parent;
}

for (const relativeFile of candidateFiles) {
  const absolutePath = path.join(root, relativeFile);
  if (fs.existsSync(absolutePath)) {
    dotenv.config({ path: absolutePath, override: true });
    loadedEnvFiles.push(absolutePath);
  }
}

const env = {
  loadedFiles: loadedEnvFiles,
  nodeEnv,
  processEnv: process.env,
};

export { env, loadedEnvFiles, nodeEnv };
