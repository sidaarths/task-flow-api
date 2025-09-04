import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import apiRoutes from './routes/api';
import logger from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Check for required environment variables
if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET environment variable is not set. Please set it in your .env file.');
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => logger.info('Connected to MongoDB'))
  .catch((error) => logger.error('MongoDB connection error:', error));

// Routes
app.use('/api', apiRoutes);

app.listen(port, () => {
  logger.info(`Server is running on port ${port}`);
});
