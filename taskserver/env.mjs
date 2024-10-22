import { pathToFileURL } from 'url';
import path from 'path';
import dotenv, {config} from 'dotenv';

const envFile = `.env.${process.env}`;

// Get the project root directory
const projectRoot = process.cwd();

let envFilePath = path.join(projectRoot, envFile);
envFilePath = pathToFileURL(envFilePath);

export const env = config({ path: envFilePath });
