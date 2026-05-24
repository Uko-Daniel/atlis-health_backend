module.exports = {
  apps: [
    {
      name:         'atlis-api',
      script:       'npx',
      args:         'tsx src/server.ts',
      cwd:          '/var/www/atlis-health/backend',
      instances:    1,
      exec_mode:    'fork',        
      autorestart:  true,
      watch:        false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}