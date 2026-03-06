import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { User } from '../models/User';
import { Board } from '../models/Board';
import { List } from '../models/List';
import { Task } from '../models/Task';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import logger from '../utils/logger';

const router = Router();

const getCredentials = (req: Request): { email: string; password: string } | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Basic ')) return null;
  try {
    const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) return null;
    const email = credentials.slice(0, colonIndex).trim();
    const password = credentials.slice(colonIndex + 1);
    if (!email || !password) return null;
    return { email, password };
  } catch {
    return null;
  }
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

router.post('/register', async (req: Request, res: Response) => {
  const credentials = getCredentials(req);
  if (!credentials) {
    return res.status(401).json({ message: 'Missing or invalid Basic Auth header', hint: 'Use Basic Authentication with email:password encoded in base64' });
  }
  const { email, password } = credentials;
  if (!isValidEmail(email)) return res.status(400).json({ message: 'Invalid email format' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  const existingUser = await User.findOne({ email });
  if (existingUser) return res.status(400).json({ message: 'User with this email already exists' });
  const user = new User({ email, password });
  await user.save();
  const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, { expiresIn: '24h' });
  logger.info(`[POST /auth/register] Registered user ${user._id}`);
  res.status(201).json({ token });
});

router.post('/login', async (req: Request, res: Response) => {
  const credentials = getCredentials(req);
  if (!credentials) {
    return res.status(401).json({ message: 'Missing or invalid Basic Auth header', hint: 'Use Basic Authentication with email:password encoded in base64' });
  }
  const { email, password } = credentials;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const isValid = await user.comparePassword(password);
  if (!isValid) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, { expiresIn: '24h' });
  logger.info(`[POST /auth/login] Logged in user ${user._id}`);
  res.json({ token });
});

// Creates an isolated demo account with pre-populated sample data.
// Each call produces a unique user so demos don't share state.
router.post('/demo', async (_req: Request, res: Response) => {
  const suffix = randomBytes(5).toString('hex');
  const email = `demo_${suffix}@taskflow.demo`;
  const password = randomBytes(16).toString('hex');

  const user = new User({ email, password });
  await user.save();

  const board = new Board({
    title: 'Demo Board',
    description: 'Explore Task Flow — drag tasks between lists, try the search bar, and open this board in two tabs to see real-time sync.',
    createdBy: user._id,
    members: [user._id],
  });
  await board.save();

  const [todo, inProgress, done] = await Promise.all([
    new List({ title: 'To Do', boardId: board._id, position: 0 }).save(),
    new List({ title: 'In Progress', boardId: board._id, position: 1 }).save(),
    new List({ title: 'Done', boardId: board._id, position: 2 }).save(),
  ]);

  await Task.insertMany([
    {
      title: 'Welcome to Task Flow!',
      description: 'This is your personal demo board. Try dragging this task to "In Progress" or clicking on it to view details.',
      listId: todo._id,
      createdBy: user._id,
      position: 0,
      labels: ['demo'],
    },
    {
      title: 'Try the search bar',
      description: 'Use the search bar at the top to filter tasks by title, description, or label in real time.',
      listId: todo._id,
      createdBy: user._id,
      position: 1,
      labels: ['tip'],
    },
    {
      title: 'Reorder lists with ← → arrows',
      description: 'Click the ← and → arrow buttons in each list header to move that column left or right. All connected users see the change instantly via SSE.',
      listId: todo._id,
      createdBy: user._id,
      position: 2,
      labels: ['tip'],
    },
    {
      title: 'Set up real-time sync',
      description: 'Open this board in a second browser tab and create a task — it will appear instantly in the first tab via SSE.',
      listId: inProgress._id,
      createdBy: user._id,
      position: 0,
      labels: ['feature'],
    },
    {
      title: 'Explore task details',
      description: 'Click on any task card to see its full details, edit its title/description, set a due date, or add labels.',
      listId: inProgress._id,
      createdBy: user._id,
      position: 1,
    },
    {
      title: 'User authentication with JWT',
      listId: done._id,
      createdBy: user._id,
      position: 0,
      labels: ['backend', 'security'],
    },
    {
      title: 'Drag & drop task reordering',
      listId: done._id,
      createdBy: user._id,
      position: 1,
      labels: ['frontend'],
    },
    {
      title: 'Server-Sent Events (SSE)',
      listId: done._id,
      createdBy: user._id,
      position: 2,
      labels: ['realtime'],
    },
  ]);

  const token = jwt.sign({ userId: user._id }, env.JWT_SECRET, { expiresIn: '24h' });
  logger.info(`[POST /auth/demo] Created demo user ${user._id}`);
  res.status(201).json({ token, boardId: board._id });
});

export default router;
