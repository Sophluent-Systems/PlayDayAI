

export function getSafeServerUrl(versionInfo, endpointType) {
    let serverUrl = versionInfo[endpointType].serverUrl;

    const url = new URL(serverUrl);

    // Make only allow localhost if DEV_ENVIRONMENT (env variable)
    // is set to true
    if (process.env.DEV_ENVIRONMENT !== 'true') {
        if (url.hostname === 'localhost') {
            throw new Error(`Cannot use localhost for ${endpointType} endpoint`);
        }
    }

    // In the future we should also block non-https requests outside
    // of DEV_ENVIRONMENTs but for now we'll just print a warning
    if (url.protocol !== 'https:') {
        console.warn(`Warning: ${endpointType} endpoint is not using HTTPS`);
    }

    return serverUrl;
}

