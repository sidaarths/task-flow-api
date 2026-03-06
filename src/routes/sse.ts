import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Board } from '../models/Board';
import { addSSEClient, removeSSEClient } from '../utils/sseManager';
import { env } from '../config/env';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /api/v1/sse/boards/:boardId?token=<jwt>
 *
 * Establishes a Server-Sent Events stream for a board.
 * JWT is passed as a query param because EventSource cannot send custom headers.
 */
router.get('/boards/:boardId', async (req: Request, res: Response) => {
  const { boardId } = req.params;
  const { token } = req.query as { token?: string };

  // 1. Validate JWT from query param
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  let userId: string;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    if (!decoded.userId || !mongoose.Types.ObjectId.isValid(decoded.userId)) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }
    userId = decoded.userId;
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }

  // 2. Validate boardId format
  if (!mongoose.Types.ObjectId.isValid(boardId)) {
    return res.status(400).json({ message: 'Invalid board ID' });
  }

  // 3. Verify user is a board member
  const board = await Board.findById(boardId);
  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const isMember =
    board.members.some((m) => m.toString() === userId) ||
    board.createdBy.toString() === userId;

  if (!isMember) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // 4. Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // 5. Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ boardId })}\n\n`);

  // 6. Register client
  const client = { res, userId, boardId, connectedAt: new Date() };
  addSSEClient(boardId, client);

  logger.info(`[SSE] User ${userId} connected to board ${boardId}`);

  // 7. Keepalive ping every 25 seconds
  const keepaliveInterval = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepaliveInterval);
    }
  }, 25_000);

  // 8. Cleanup on disconnect
  req.on('close', () => {
    clearInterval(keepaliveInterval);
    removeSSEClient(boardId, client);
    logger.info(`[SSE] User ${userId} disconnected from board ${boardId}`);
  });
});

export default router;
