// PM2 config for the VPS (user deploy): pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: "monitor-matrix",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3003",
      instances: 1, // the login throttle lives in memory
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "400M",
    },
  ],
};
