// next.config.js
import webpack from 'webpack';
import dotenv from 'dotenv';

let env = {};


console.error(`NODE_ENV: ${process.env.NODE_ENV}`);
env = dotenv.config({ path: `.env` }).parsed;

export default {
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config, options) => {
      config.optimization.minimize = true;
      config.experiments = { ...config.experiments, topLevelAwait: true };
      config.resolve =  {
        ...config.resolve,
        alias: {
          ...config.resolve.alias,
          '@src': './src',
          '@components': './src/client/components',
          '@styles': './frontend/styles'
        }
     }
     return config
  },
  env
};
