import { defaultConfig } from '@src/common/defaultconfig.js';

export async function getConstants(db) {
    try {
        const coll = db.collection('settings');
        const data = await coll.findOne({ setting: 'Constants' });
        return data.constants;
    } catch (error) {
        console.error('Error fetching Constants:', error);
        throw error;
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
