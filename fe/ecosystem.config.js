module.exports = {
  apps: [
    {
      name: 'FE', // Name of the application
      script: 'yarn', // Command to run the application
      args: 'start',
      exec_mode: 'fork', // Execution mode ('cluster' or 'fork')
      instances: 1, // Number of instances (number of CPU cores to be used) - 'max' to use as much as possible
      autorestart: true, // Automatically restart the application if it crashes
      watch: false, // Watch for file changes and restart as needed
      max_memory_restart: '1G' // Maximum memory limit before restarting the application
    }
  ]
}
