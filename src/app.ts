import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import apiRoutes from './routes/api';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

const app = express();

// Security headers
app.use(helmet());

// CORS
const getAllowedOrigins = (): (string | RegExp)[] => {
  const origins: (string | RegExp)[] = [
    'http://localhost:3000',
    'https://task-flow-web-tawny.vercel.app',
    /^https:\/\/task-flow-web.*\.vercel\.app$/,
  ];
  if (env.CLIENT_URL) origins.push(env.CLIENT_URL);
  return origins;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = getAllowedOrigins();
      const isAllowed = allowed.some((o) =>
        typeof o === 'string' ? o === origin : o.test(origin)
      );
      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn(`[CORS] Blocked request from: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
  })
);

// Tighter rate limit for auth routes
app.use(
  '/api/v1/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Too many auth attempts, please try again later.' },
  })
);

// Routes
app.use('/api/v1', apiRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Centralized error handler (must be last)
app.use(errorHandler);

export default app;
