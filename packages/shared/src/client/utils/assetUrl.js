export function buildAssetUrl(relativePath) {
  // relativePath should start with / (e.g., "/gen/images/abc123.png")
  
  // Check for NEXT_PUBLIC_ASSET_BASE_URL environment variable
  const assetBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  
  if (assetBaseUrl) {
    // If the base URL already has a protocol, use it as-is
    if (assetBaseUrl.startsWith('http://') || assetBaseUrl.startsWith('https://')) {
      const normalizedBase = assetBaseUrl.replace(/\/$/, '');
      return `${normalizedBase}${relativePath}`;
    }
    
    // Otherwise, determine protocol from NEXT_PUBLIC_PROTOCOL
    const protocol = process.env.NEXT_PUBLIC_PROTOCOL === 'HTTPS' ? 'https:' : 
                     process.env.NEXT_PUBLIC_PROTOCOL === 'HTTP' ? 'http:' : 
                     'https:'; // default to https
    const normalizedBase = assetBaseUrl.replace(/\/$/, '');
    return `${protocol}//${normalizedBase}${relativePath}`;
  }
  
  // Fallback to relative path (for development or if not configured)
  return relativePath;
}

