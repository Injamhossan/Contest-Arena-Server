require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const initializeAdmin = require('./scripts/initializeAdmin');

const PORT = process.env.PORT || 5000;

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is not set in .env file!');
  console.error('Please add JWT_SECRET to your .env file.');
  console.error('Example: JWT_SECRET=your-secret-key-here');
  process.exit(1);
}

if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI is not set in .env file!');
  console.error('Please add MONGODB_URI to your .env file.');
  process.exit(1);
}

console.log('✅ Environment variables validated');

// Connect to MongoDB
connectDB()
  .then(async () => {
    await initializeAdmin();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});


