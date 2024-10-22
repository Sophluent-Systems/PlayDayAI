// custom-loader.mjs
import { pathToFileURL } from 'url';
import path from 'path';


export async function resolve(specifier, context, defaultResolve) {
  let newSpecifier = specifier;

  try {

    let result = await defaultResolve(newSpecifier, context, defaultResolve);
    return result;

  } catch (error) {

    if (newSpecifier.startsWith('@')) {
      // Get the project root directory
      const projectRoot = process.cwd();

      // Replace '@/'' with the absolute path to the project root
      // Ensure the path is formatted as a file URL
      newSpecifier = newSpecifier.replace('@', '');

      let filePath = path.join(projectRoot, newSpecifier);

      // Convert the file path to a file URL
      newSpecifier = pathToFileURL(filePath).href;
    }
    
    // Fallback to default resolution
    try {
        let result = await defaultResolve(newSpecifier, context, defaultResolve);
        return result;
    } catch (error) {

      // Ensure the specifier ends with '.js' if not already
      if (!newSpecifier.endsWith('.js')) {
        newSpecifier += '.js';
      }
      
      return defaultResolve(newSpecifier, context, defaultResolve);
    }
  }
}
