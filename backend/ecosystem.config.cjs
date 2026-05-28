module.exports = {
  apps: [
    {
      name: "agentzap",
      script: "dist/server.js",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      env: { NODE_ENV: "production" },
    },
  ],
};
