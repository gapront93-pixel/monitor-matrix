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
      // A smaller V8 heap makes the GC run before PM2's 400MB limit (otherwise the heap just grows towards it)
      node_args: "--max-old-space-size=256",
      // MALLOC_ARENA_MAX: fewer glibc arenas, so memory freed after image processing is reused instead of piling up
      env: { NODE_ENV: "production", MALLOC_ARENA_MAX: "2" },
      max_memory_restart: "400M",
    },
  ],
};
