import { Auth0Client } from "@auth0/nextjs-auth0/server";

const isSandbox = process.env.SANDBOX === "true";

const normalizeDomain = (rawDomain) => {
    if (!rawDomain) {
      return undefined;
    }
    try {
      const trimmed = rawDomain.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return new URL(trimmed).host;
      }
      return trimmed;
    } catch (error) {
      console.error("[auth0] Failed to normalize Auth0 domain", error);
      return undefined;
    }
  };
  
  const rawDomain = process.env.AUTH0_DOMAIN ?? process.env.AUTH0_ISSUER_BASE_URL;
  const domain = normalizeDomain(rawDomain);
  
  const appBaseUrl = process.env.APP_BASE_URL ?? process.env.AUTH0_BASE_URL;
  
const auth0Options = !isSandbox
  ? {
      domain,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      secret: process.env.AUTH0_SECRET,
      appBaseUrl,
      authorizationParameters: {
        audience: process.env.AUTH0_AUDIENCE,
        scope:
          process.env.AUTH0_SCOPE ?? "openid profile email offline_access",
      },
      enableAccessTokenEndpoint: false,
    }
  : undefined;

let auth0Instance = null;

if (!isSandbox) {
  try {
    auth0Instance = new Auth0Client(auth0Options);
  } catch (error) {
    console.error("[auth0] Failed to initialize Auth0Client", error);
  }
}

export const auth0 = auth0Instance;
export const auth0IsSandbox = isSandbox;