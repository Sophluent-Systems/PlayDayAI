module.exports = {
  apps: [
    {
      name: 'taskserver',
      script: 'npm start',
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.WS_LOCAL_PORT ?? process.env.NEXT_PUBLIC_WS_PORT,
      }
    },
  ],
};
