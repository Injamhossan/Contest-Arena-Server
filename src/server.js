require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const initializeAdmin = require('./scripts/initializeAdmin');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB()
  .then(async () => {
    // Initialize default admin account
    await initializeAdmin();

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});


