import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import apiRoutes from './routes/api';
import logger from './utils/logger';
import { initializePusher } from './utils/socketManager';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Check for required environment variables
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set. Please set it in your .env file.');
  process.exit(1);
}

// CORS configuration
const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'https://task-flow-web-tawny.vercel.app',
  ];

  // Add custom origin from environment variable if provided
  if (process.env.CLIENT_URL) {
    origins.push(process.env.CLIENT_URL);
  }

  return origins;
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } 
    // Allow task-flow-web Vercel deployments
    else if (origin.match(/^https:\/\/task-flow-web.*\.vercel\.app$/)) {
      callback(null, true);
    } 
    else {
      logger.warn(`[API] Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => logger.info('Connected to MongoDB'))
  .catch((error) => logger.error('MongoDB connection error:', error));

// Routes
app.use('/api', apiRoutes);

// Initialize Pusher
try {
  initializePusher();
  logger.info('Pusher initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Pusher:', error);
  process.exit(1);
}

// Start server
app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
  logger.info(`Pusher is ready for real-time events`);
});
