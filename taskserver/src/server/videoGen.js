import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAIEndpoint from './videoGenEndpoints/openai.js';

const endpoints = {
  openai: OpenAIEndpoint.doGenerateVideo,
};

async function ensureDirectoryExists(directoryPath) {
  try {
    await fs.access(directoryPath);
  } catch (error) {
    await fs.mkdir(directoryPath, { recursive: true });
  }
}

async function persistBinary({ directory, filename, buffer }) {
  const targetDirectory = path.join(process.cwd(), '../public', directory);
  await ensureDirectoryExists(targetDirectory);

  const filePath = path.join(targetDirectory, filename);
  await fs.writeFile(filePath, buffer);

  return path.join('/', directory, filename).replace(/\\/g, '/');
}

export async function doVideoGeneration(params) {
  if (!params.endpoint) {
    throw new Error("doVideoGeneration: endpoint not specified");
  }

  const generator = endpoints[params.endpoint];
  if (!generator) {
    throw new Error(`doVideoGeneration: unsupported endpoint "${params.endpoint}"`);
  }

  const generationResult = await generator(params);
  const { buffer, metadata = {}, thumbnail } = generationResult;

  if (!buffer) {
    throw new Error("doVideoGeneration: endpoint did not return video content");
  }

  const fileExtension = metadata.contentType?.includes('webm')
    ? 'webm'
    : metadata.contentType?.includes('mov')
    ? 'mov'
    : 'mp4';

  const videoFilename = `${uuidv4()}.${fileExtension}`;
  const videoPath = await persistBinary({
    directory: 'gen/videos',
    filename: videoFilename,
    buffer,
  });

  let thumbnailPath = null;
  if (thumbnail instanceof Buffer && thumbnail.length > 0) {
    const thumbFilename = `${uuidv4()}.jpg`;
    thumbnailPath = await persistBinary({
      directory: 'gen/video-thumbnails',
      filename: thumbFilename,
      buffer: thumbnail,
    });
  }

  return {
    path: videoPath,
    metadata: {
      ...metadata,
      thumbnail: thumbnailPath,
    },
  };
}
