import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { searchUsersSchema, userParamSchema } from '../schemas/user.schemas';
import logger from '../utils/logger';

const router = Router();

// Get current user profile
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  logger.info(`[GET /users/me] Fetched profile for user ${user._id}`);
  res.json(user);
});

// Search users by email
router.get('/', authMiddleware, validate(searchUsersSchema), async (req: Request, res: Response) => {
  const searchTerm = req.query.email as string;
  // Escape regex metacharacters to prevent ReDoS and result-set expansion
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({ email: { $regex: escaped, $options: 'i' } })
    .select('-password')
    .limit(10);
  logger.info(`[GET /users] Found ${users.length} users matching "${searchTerm}"`);
  res.json(users);
});

// Get user by ID
router.get('/:userId', authMiddleware, validate(userParamSchema), async (req: Request, res: Response) => {
  const user = await User.findById(req.params.userId).select('-password');
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
});

export default router;
