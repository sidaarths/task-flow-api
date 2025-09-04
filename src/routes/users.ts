import { Router, Request } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res) => {
  try {
    console.log(`[GET /users/me] Fetching profile for user`);
    if (!req.user) {
      console.log('[GET /users/me] Unauthorized request - no user in context');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      console.log(`[GET /users/me] User ${req.user.userId} not found in database`);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log(`[GET /users/me] Successfully fetched profile for user ${user._id}`);
    res.json(user);
  } catch (error) {
    console.error('[GET /users/me] Error fetching user profile:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid user data' });
    } else {
      res.status(500).json({ message: 'Error fetching user profile' });
    }
  }
});

// Search users
router.get('/search', authMiddleware, async (req: Request, res) => {
  try {
    console.log(`[GET /users/search] Searching users with query: ${req.query.q}`);
    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      console.log('[GET /users/search] No search term provided');
      return res.status(400).json({ message: 'Search term is required' });
    }

    const users = await User.find({
      email: { $regex: searchTerm, $options: 'i' }
    }).select('-password').limit(10);

    console.log(`[GET /users/search] Found ${users.length} users matching "${searchTerm}"`);
    res.json(users);
  } catch (error) {
    console.error('[GET /users/search] Error searching users:', error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid search parameters' });
    } else {
      res.status(500).json({ message: 'Error searching users' });
    }
  }
});

export default router;
