import { Router, Request } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { authMiddleware } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res) => {
  try {
    logger.info(`[GET /users/me] Fetching profile for user`);
    if (!req.user) {
      logger.warn('[GET /users/me] Unauthorized request - no user in context');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      logger.warn(`[GET /users/me] User ${req.user.userId} not found in database`);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.info(`[GET /users/me] Successfully fetched profile for user ${user._id}`);
    res.json(user);
  } catch (error) {
    logger.error('[GET /users/me] Error fetching user profile:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid user data' });
    } else {
      res.status(500).json({ message: 'Error fetching user profile' });
    }
  }
});

// Search users
router.get('/', authMiddleware, async (req: Request, res) => {
  try {
    logger.info(`[GET /users/] Searching users with query: ${req.query.email}`);
    const searchTerm = req.query.email as string;
    if (!searchTerm) {
      logger.warn('[GET /users/] No search term provided');
      return res.status(400).json({ message: 'Search term is required' });
    }

    const users = await User.find({
      email: { $regex: searchTerm, $options: 'i' }
    }).select('-password').limit(10);

    logger.info(`[GET /users/] Found ${users.length} users matching "${searchTerm}"`);
    res.json(users);
  } catch (error) {
    logger.error('[GET /users/] Error searching users:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid search parameters' });
    } else {
      res.status(500).json({ message: 'Error searching users' });
    }
  }
});

// Get user by ID
router.get('/:userId', authMiddleware, async (req: Request, res) => {
  try {
    const { userId } = req.params;
    logger.info(`[GET /users/${userId}] Fetching user by ID`);
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      logger.warn(`[GET /users/${userId}] Invalid user ID format`);
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findById(userId).select('-password');
    if (!user) {
      logger.warn(`[GET /users/${userId}] User not found`);
      return res.status(404).json({ message: 'User not found' });
    }
    logger.info(`[GET /users/${userId}] Successfully fetched user ${user._id}`);
    res.json(user);
  } catch (error) {
    logger.error(`[GET /users/:userId] Error fetching user by ID:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid user ID format' });
    } else {
      res.status(500).json({ message: 'Error fetching user by ID' });
    }
  }
});

export default router;
