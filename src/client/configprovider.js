import React, { createContext, useContext, useState, useEffect } from 'react';
import { defaultConfig } from '@src/common/defaultconfig';
import { useUser } from "@src/client/auth";

const ConfigContext = createContext(defaultConfig);

export function ConfigProvider({ children }) {
    const [config, setConfig] = useState(defaultConfig);
    const auth0 = useUser();

    async function updateConfig() {
        try {
            const response = await fetch('/api/getconfig');
            const data = await response.json();
            if (response.status === 200) {
                setConfig(prevConfig => ({ ...prevConfig, ...data }));
            }
        } catch (error) {
            console.error("Error updating config:", error);
        }
    }

    useEffect(() => {
        if (process.env.SANDBOX != "true") {
            if (!auth0.isLoading && auth0.user) {
                updateConfig();
            }
        } else {
            setConfig(defaultConfig);
        }
    }, [auth0.isLoading]);

    return (
        <ConfigContext.Provider value={config}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}

export const Config = defaultConfig; // For use outside of React components