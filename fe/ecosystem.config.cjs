module.exports = {
  apps: [
    {
      name: "Doka", // Name of the application
      script: "npm", // Command to run the application
      args: "run start",
      exec_mode: "fork", // Execution mode ('cluster' or 'fork')
      instances: 1, // Number of instances (number of CPU cores to be used) - 'max' to use as much as possible
      autorestart: true, // Automatically restart the application if it crashes
      watch: false, // Watch for file changes and restart as needed
      max_memory_restart: "1G", // Maximum memory limit before restarting the application
      env: {
        // Running environment (development, production, ...)
        NODE_ENV: "production",
        PORT: 3001,
        API_BASE_URL: "http://157.245.150.180:3000",
      },
    },
  ],
};
