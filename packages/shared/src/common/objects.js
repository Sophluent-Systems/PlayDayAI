

export function areObjectsIdentical(objA, objB) {
    const keysA = Object.keys(objA).sort();
    const keysB = Object.keys(objB).sort();
    
    if ( JSON.stringify(keysA) !== JSON.stringify(keysB)) {
        return false;
    }

    for (let key of keysA) {
        // Check if they are the same type
        if (typeof objA[key] !== typeof objB[key]) {
            return false;
        }
        // If objects or arrays, do a deep comparison using JSON.stringify
        if (typeof objA[key] === 'object' || Array.isArray(objA[key])) {
            if (JSON.stringify(objA[key]) !== JSON.stringify(objB[key])) {
                return false;
            }
        } else if (objA[key] !== objB[key]) {
            return false;
        }
    }

    return true;
  }

  export async function measure_async(fn, description) {
    const start = performance.now();
    var result = await fn();
    const end = performance.now();
    const timeTaken = end - start;
  
    const seconds = Math.floor(timeTaken / 1000);
    const milliseconds = (timeTaken-seconds) % 1000;

    return result;
  }

  export  function getNestedObjectProperty(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

export function setNestedObjectProperty(obj, path, value) {
    const parts = path.split('.');
    const lastKey = parts.pop();
    
    // Traverse the object to the last sub-object where the property should be set
    const lastObj = parts.reduce((acc, part) => {
        // If the current key does not exist in the object, or it's not an object, create it as an empty object
        if (!acc[part] || typeof acc[part] !== 'object') {
            acc[part] = {};
        }
        return acc[part];
    }, obj);

    // Set the value at the final key
    lastObj[lastKey] = value;
}


export function nullUndefinedOrEmpty(value, allowEmptyValue=false) {
    if (value == null || (typeof value == 'undefined')) {
      return true;
    }
    if (!allowEmptyValue && typeof value == 'string' && value.trim().length == 0) {
      return true;
    }
    if (!allowEmptyValue && Array.isArray(value) && value.length == 0) {
      return true;
    }
    if (!allowEmptyValue && typeof value == 'object' && Object.keys(value).length == 0) {
      return true;
    }
    return false;
  };
  
export  function isObject(value) {
    return (typeof value == 'object');
}

export function objectDepthFirstSearch(obj, process, path = null) {
    if (!obj) {
      throw new Error("objectDepthFirstSearch: obj must be an object or an array but " + path + " = " + (typeof obj));
    }

    if (Array.isArray(obj)) {
      obj.map((value, index) => {
        const currentPath = path ? `${path}[${index}]` : `[${index}]`;
        const shouldContinue = process(currentPath, value);
        if (shouldContinue && (isObject(value) || Array.isArray(value))) {
          objectDepthFirstSearch(value, process, currentPath);
        }
      });
    } else if (isObject(obj)) {
      Object.keys(obj).sort().forEach((key) => {
        const value = obj[key];
        const currentPath = path ? `${path}.${key}` : key;
        const shouldContinue = process(currentPath, value);
        if (shouldContinue && (isObject(value) || Array.isArray(value))) {
          objectDepthFirstSearch(value, process, currentPath);
        } 
      });
    } else {
      throw new Error("objectDepthFirstSearch: obj must be an object or an array but received" + (typeof obj));
    }
}

  export  function flattenObject(obj, pathRoot) {
    let result = [];
  
    function process(path, value) {
      if (!isObject(value) && !Array.isArray(value)) {
        result.push(`${path}=${value}`);
      }
      return true;
    }
  
    objectDepthFirstSearch(obj, process, pathRoot);
    return result;
  }

  export  function attemptToParseJSON_UNSAFE(jsonLikeString) {
    try {
        // Evaluate the string as a JavaScript object
        var obj = eval('(' + jsonLikeString + ')');

        // Convert the object back to a JSON string
        return obj;
    } catch (e) {
        return null;
    }
}

export function stringifyWithDepth(obj, maxDepth) {
    function replacer(depth) {
        return function(key, value) {
            if (depth > maxDepth && typeof value === 'object' && value !== null) {
                return Array.isArray(value) ? `[Array(${value.length})]` : '[Object]'; // Placeholder for arrays/objects
            }
            return value;
        };
    }

    function stringify(obj, depth) {
        if (typeof obj === 'object' && obj !== null) {
            return JSON.stringify(obj, replacer(depth), 2);
        } else {
            return JSON.stringify(obj); // Directly stringify non-objects
        }
    }

    return stringify(obj, 0);
}

export function parseAsDiscreteTypeIfPossible(value) {
    if (typeof value === "string") {
        try {
            const parsedValue = parseFloat(value);
            if (!isNaN(parsedValue)) {
                return parsedValue;
            }
        } catch (e) {
            // Do nothing
        }
        if (value.trim().toLowerCase() === "true") {
            return true;
        }
        if (value.trim().toLowerCase() === "false") {
            return false;
        }
    }
    return value;
}
