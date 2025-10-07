// custom-loader.mjs
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { createRequire } from 'module';

const loaderDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(loaderDir, '..');
const sharedSrcDir = path.join(workspaceRoot, 'packages', 'shared', 'src');
const requireFromLoader = createRequire(import.meta.url);

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


async function resolveFromAppRoot(specifier, context, defaultResolve) {
  const fallbackParentURL = pathToFileURL(path.join(loaderDir, 'server.mjs')).href;
  const patchedContext = {
    ...context,
    parentURL: fallbackParentURL,
  };

  try {
    return await defaultResolve(specifier, patchedContext, defaultResolve);
  } catch (error) {
    if (error && error.code !== 'ERR_MODULE_NOT_FOUND') {
      console.debug(`[custom-loader] resolveFromAppRoot fallback failed for ${specifier}:`, error);
    }
    return null;
  }
}

function resolveFromTaskserverNodeModules(specifier) {
  if (!specifier || specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')) {
    return null;
  }

  try {
    const resolvedPath = requireFromLoader.resolve(specifier);
    return pathToFileURL(resolvedPath).href;
  } catch (error) {
    if (error && error.code !== 'MODULE_NOT_FOUND') {
      console.warn(`Custom loader failed to resolve ${specifier}:`, error);
    }
    return null;
  }
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
      const appRootMatch = await resolveFromAppRoot(specifier, context, defaultResolve);
      if (appRootMatch) {
        return appRootMatch;
      }

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
