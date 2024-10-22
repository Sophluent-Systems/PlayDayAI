module.exports = {
  apps: [
    {
      name: 'taskserver',
      script: 'npm start',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.LOCALHOST_WEBSOCKET_PORT,
      }
    },
  ],
};
