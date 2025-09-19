// custom-loader.mjs
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const loaderDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(loaderDir, '..');
const sharedSrcDir = path.join(workspaceRoot, 'packages', 'shared', 'src');
const taskserverNodeModules = path.join(loaderDir, 'node_modules');

const aliasMap = [
  ['@src/', sharedSrcDir],
  ['@components/', path.join(sharedSrcDir, 'client', 'components')]
];

const exactAliasMap = new Map([
  ['@src', sharedSrcDir],
  ['@components', path.join(sharedSrcDir, 'client', 'components')]
]);

function resolveWithAliases(specifier) {
  if (exactAliasMap.has(specifier)) {
    return pathToFileURL(exactAliasMap.get(specifier)).href;
  }

  for (const [prefix, targetDir] of aliasMap) {
    if (specifier.startsWith(prefix)) {
      const relativePath = specifier.slice(prefix.length);
      const filePath = path.join(targetDir, relativePath);
      return pathToFileURL(filePath).href;
    }
  }

  return null;
}

function resolveFromTaskserverNodeModules(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')) {
    return null;
  }

  const candidateDir = path.join(taskserverNodeModules, specifier);
  if (fs.existsSync(candidateDir)) {
    return pathToFileURL(candidateDir).href;
  }

  const candidateFile = candidateDir + '.js';
  if (fs.existsSync(candidateFile)) {
    return pathToFileURL(candidateFile).href;
  }

  return null;
}

export async function resolve(specifier, context, defaultResolve) {
  let newSpecifier = specifier;

  try {
    return await defaultResolve(newSpecifier, context, defaultResolve);
  } catch (initialError) {
    const aliased = resolveWithAliases(newSpecifier);
    if (aliased) {
      newSpecifier = aliased;
    }

    try {
      return await defaultResolve(newSpecifier, context, defaultResolve);
    } catch (secondError) {
      const nodeModulesMatch = resolveFromTaskserverNodeModules(specifier);
      if (nodeModulesMatch) {
        try {
          return await defaultResolve(nodeModulesMatch, context, defaultResolve);
        } catch (thirdError) {
          throw thirdError;
        }
      }

      const shouldTryExtension = Boolean(aliased) || newSpecifier.startsWith('.') || newSpecifier.startsWith('file://');

      if (shouldTryExtension && !newSpecifier.endsWith('.js')) {
        const withExtension = newSpecifier + '.js';
        return defaultResolve(withExtension, context, defaultResolve);
      }

      throw secondError;
    }
  }
}
