//
// DO NOT IMPORT 'CONSTANTS'... ON THE CRITICAL PATH OF RETRIEVING CONSTANTS
//
import { getSession as originalGetSession, withApiAuthRequired as originalWithApiAuthRequired } from '@auth0/nextjs-auth0';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const isSandbox = process.env.SANDBOX == 'true';
const auth0Domain = process.env.AUTH0_ISSUER_BASE_URL;
const auth0Audience = process.env.AUTH0_AUDIENCE;
const jwksUri = `${auth0Domain}/.well-known/jwks.json`;

export const client = jwksClient({
  jwksUri: jwksUri,
});

function getKey(header, callback){
if (isSandbox) {
  callback(null, "XYZ");
  return;
}

client.getSigningKey(header.kid, function(err, key) {
  var signingKey = key.publicKey || key.rsaPublicKey;
  callback(null, signingKey);
});
}

export   const validateToken = isSandbox ? async (token) => mockSession.user : async (token) => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: auth0Audience,
      issuer: auth0Domain + "/",
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
}


// Mock Data
const mockSession = {
  user: {
      sub: "default-user",
      email: "local_admin@"
  },
  accessToken: "MOCKMOCKMOCK"
};

if (isSandbox) {
  console.error("**************** AUTH ****************");
  console.error("***** isSandbox = ", isSandbox ? "yes" : "no");
  console.error("**************************************");
}


const logAuthFaillures = (wrappedFunction) => (handler) => {
  return async (req, res) => {
    const originalJson = res.json;
    res.json = function(body) {
      if (res.statusCode === 401) {
        console.error(`Route: ${req.url}`);
        console.error('Headers:', JSON.stringify(req.headers, null, 2));
        console.error(`Status Code: ${res.statusCode}`);
      }
      originalJson.call(this, body);
    };

    try {
      await wrappedFunction(handler)(req, res);
    } catch (error) {
      if (error.status === 401) {
        console.error(`Route: ${req.url}`);
        console.error('Headers:', JSON.stringify(req.headers, null, 2));
        console.error(`Status Code: 401`);
      }
      throw error;
    }
  };
};

export const getSession = isSandbox ? async () => mockSession : originalGetSession;


export const requireAuthorization = (handler) => {
  return async (req, res) => {

    try {
      let accessToken;
      let user;
      
      if (req.headers.authorization && !isSandbox) {
        accessToken = req.headers.authorization.split(' ')[1];
        user = await validateToken(accessToken);
      } else {
        const session = await getSession(req, res);
        if (session) {
          accessToken = session.accessToken;
          user = session.user;
        }
      }

      if (user) {
        // Attach user and accessToken to the request object
        req.user = user;
        req.accessToken = accessToken;
        return handler(req, res);
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ error: 'Unauthorized' });
    }
  };
};

export const withApiAuthRequired = requireAuthorization;

