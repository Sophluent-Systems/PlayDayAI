module.exports = {
  apps: [
    {
      name: 'frontend',
      script: `NODE_ENV=${process.env.NODE_ENV} node server.js`,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.LOCALHOST_FRONTEND_PORT,
      }
    },
  ],
};
