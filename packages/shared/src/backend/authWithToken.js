//
// Centralized Auth0 helpers for both sandbox and production modes.
//
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

import { auth0, auth0IsSandbox } from './auth0';

const auth0Client = auth0;

const issuerBaseUrl = process.env.AUTH0_DOMAIN?.replace(/\/$/, '') ?? process.env.AUTH0_DOMAIN?.replace(/\/$/, '');
const domainForJwks = issuerBaseUrl?.startsWith('http') ? issuerBaseUrl : (issuerBaseUrl ? `https://${issuerBaseUrl}` : undefined);
const jwksUri = domainForJwks ? `${domainForJwks}/.well-known/jwks.json` : undefined;
const auth0Audience = process.env.AUTH0_AUDIENCE;

// Mock Data
const mockSession = {
  user: {
    sub: 'default-user',
    email: 'local_admin@',
  },
  accessToken: 'MOCKMOCKMOCK',
  tokenSet: {
    accessToken: 'MOCKMOCKMOCK',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    scope: 'openid profile email',
  },
};

const client = jwksUri
  ? jwksClient({
      jwksUri,
    })
  : null;

function getKey(header, callback) {
  if (auth0IsSandbox) {
    callback(null, 'XYZ');
    return;
  }

  if (!client) {
    callback(new Error('Auth0 JWKS client is not configured'));
    return;
  }

  client.getSigningKey(header.kid, function (err, key) {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

export const validateToken = auth0IsSandbox
  ? async () => mockSession.user
  : async (token) => {
      return new Promise((resolve, reject) => {
        if (!token) {
          reject(new Error('Missing token'));
          return;
        }

        jwt.verify(
          token,
          getKey,
          {
            audience: auth0Audience,
            issuer: domainForJwks ? `${domainForJwks}/` : undefined,
            algorithms: ['RS256'],
          },
          (err, decoded) => {
            if (err) {
              reject(err);
            } else {
              resolve(decoded);
            }
          }
        );
      });
    };


async function getAuth0Session(req) {
  if (!auth0Client) {
    return null;
  }

  try {
    if (req?.nextRequest) {
      return await auth0Client.getSession(req.nextRequest);
    }
    if (req?.originalRequest) {
      return await auth0Client.getSession(req.originalRequest);
    }
    return await auth0Client.getSession();
  } catch (error) {
    console.error('[auth0] Failed to retrieve session', error);
    return null;
  }
}

const toLegacySessionShape = (session) => {
  if (!session) {
    return null;
  }

  const accessToken = session.tokenSet?.accessToken;
  return {
    user: session.user,
    accessToken,
    tokenSet: session.tokenSet,
    session,
  };
};

export const getSession = async (req, res) => {
  if (auth0IsSandbox) {
    return mockSession;
  }

  const session = await getAuth0Session(req, res);
  return toLegacySessionShape(session);
};

export const requireAuthorization = (handler) => {
  return async (req, res) => {
    try {
      let accessToken;
      let user;

      if (req.headers?.authorization && !auth0IsSandbox) {
        accessToken = req.headers.authorization.split(' ')[1];
        user = await validateToken(accessToken);
      } else {
        const session = await getSession(req, res);
        accessToken = session?.accessToken;
        user = session?.user;
        if (!req.session && session?.session) {
          req.session = session.session;
        }
      }

      if (user) {
        req.user = user;
        if (accessToken) {
          req.accessToken = accessToken;
        }
        return handler(req, res);
      }

      res.status(401).json({ error: { message: 'Unauthorized' } });
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ error: { message: 'Unauthorized' } });
    }
  };
};

export const withApiAuthRequired = requireAuthorization;
