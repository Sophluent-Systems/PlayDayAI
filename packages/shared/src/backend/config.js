import { defaultConfig } from '@src/common/defaultconfig.js';

function cloneDefaultConstants() {
    return JSON.parse(JSON.stringify(defaultConfig.Constants));
}

function valuesAreEqual(a, b) {
    if (a === b) {
        return true;
    }

    if (typeof a !== typeof b) {
        return false;
    }

    if (typeof a === 'object' && a !== null && b !== null) {
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch (error) {
            console.warn('Unable to compare values for merge, falling back to inequality check:', error);
        }
    }

    return false;
}

function mergeConstants(target, source) {
    if (!source || typeof source !== 'object') {
        return target;
    }

    for (const [key, value] of Object.entries(source)) {
        const targetValue = target[key];

        if (Array.isArray(value)) {
            const baseArray = Array.isArray(targetValue) ? targetValue : [];
            const merged = value.slice();

            if (value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item))) {
                for (const item of baseArray) {
                    if (!merged.includes(item)) {
                        merged.push(item);
                    }
                }
            } else if (value.every((item) => item && typeof item === 'object' && 'value' in item)) {
                const seenValues = new Set(value.map((item) => item?.value));
                for (const item of baseArray) {
                    if (item && typeof item === 'object' && 'value' in item) {
                        if (!seenValues.has(item.value)) {
                            merged.push(item);
                            seenValues.add(item.value);
                        }
                    } else if (!merged.some((existing) => valuesAreEqual(existing, item))) {
                        merged.push(item);
                    }
                }
            } else {
                for (const item of baseArray) {
                    if (!merged.some((existing) => valuesAreEqual(existing, item))) {
                        merged.push(item);
                    }
                }
            }

            target[key] = merged;
        } else if (value && typeof value === 'object') {
            if (!targetValue || typeof targetValue !== 'object' || Array.isArray(targetValue)) {
                target[key] = {};
            }
            mergeConstants(target[key], value);
        } else if (value !== undefined) {
            target[key] = value;
        }
    }

    return target;
}

export async function getConstants(db) {
    const baseConstants = cloneDefaultConstants();

    if (!db) {
        return baseConstants;
    }

    try {
        const coll = db.collection('settings');
        const data = await coll.findOne({ setting: 'Constants' });

        if (!data || !data.constants) {
            return baseConstants;
        }

        return mergeConstants(baseConstants, data.constants);
    } catch (error) {
        console.error('Error fetching Constants:', error);
        return baseConstants;
    }
}

let loadedConfig = {};

export async function loadConfig(db) {
    try {
        loadedConfig.Constants = await getConstants(db);
    } catch (error) {
        console.error("Error fetching constants from database:", error);
    }

    if (!loadedConfig) {
        console.warn("Using default constants");
        loadedConfig = { ...defaultConfig };
    }
}

export const Config = new Proxy({}, {
    get: (target, prop) => {
        if (loadedConfig && prop in loadedConfig) {
            return loadedConfig[prop];
        }
        return defaultConfig[prop];
    },
    set: (target, prop, value) => {
        if (loadedConfig) {
            loadedConfig[prop] = value;
        }
        return true;
    }
});
