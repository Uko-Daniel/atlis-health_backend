module.exports = {
  apps: [
    {
      name: 'atlis-api',
      script: 'src/server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}