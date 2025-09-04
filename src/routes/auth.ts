import { Router, Request } from 'express';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

const router = Router();

// Helper function to parse Basic Auth header
const getCredentials = (req: Request): { email: string; password: string } | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return null;
  }

  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [email, password] = credentials.split(':');
    return { email, password };
  } catch (error) {
    return null;
  }
};

// User registration
router.post('/register', async (req, res) => {
  try {
    logger.info('[POST /auth/register] Processing registration request');
    
    const credentials = getCredentials(req);
    if (!credentials) {
      logger.warn('[POST /auth/register] Missing or invalid Basic Auth header');
      return res.status(401).json({ 
        message: 'Missing or invalid Basic Auth header',
        hint: 'Use Basic Authentication with email:password encoded in base64'
      });
    }

    const { email, password } = credentials;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`[POST /auth/register] User already exists with email ${email}`);
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    const user = new User({ email, password });
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    logger.info(`[POST /auth/register] Successfully registered user ${user._id}`);
    res.status(201).json({ token });
  } catch (error) {
    logger.error('[POST /auth/register] Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    logger.info('[POST /auth/login] Processing login request');
    
    const credentials = getCredentials(req);
    if (!credentials) {
      logger.warn('[POST /auth/login] Missing or invalid Basic Auth header');
      return res.status(401).json({ 
        message: 'Missing or invalid Basic Auth header',
        hint: 'Use Basic Authentication with email:password encoded in base64'
      });
    }

    const { email, password } = credentials;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`[POST /auth/login] No user found with email ${email}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn(`[POST /auth/login] Invalid password for user ${user._id}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    logger.info(`[POST /auth/login] Successfully logged in user ${user._id}`);
    res.json({ token });
  } catch (error) {
    logger.error('[POST /auth/login] Error logging in:', error);
    res.status(500).json({ message: 'Error logging in', error });
  }
});

export default router;
