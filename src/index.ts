import mongoose from 'mongoose';
import { env } from './config/env';
import app from './app';
import logger from './utils/logger';

mongoose
  .connect(env.MONGODB_URI)
  .then(() => logger.info('[DB] Connected to MongoDB'))
  .catch((error) => {
    logger.error('[DB] Connection error:', error);
    process.exit(1);
  });

app.listen(env.PORT, () => {
  logger.info(`[Server] Running on port ${env.PORT} (${env.NODE_ENV})`);
  logger.info('[SSE] Real-time via Server-Sent Events');
});
