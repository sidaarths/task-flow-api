import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/auth';
import { getPusher } from '../utils/socketManager';
import { Board } from '../models/Board';
import logger from '../utils/logger';

const router = Router();

// Pusher authentication endpoint for private channels
router.post('/auth', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('[Pusher Auth] Received auth request:', { body: req.body, headers: req.headers['content-type'] });
    
    const socketId = req.body.socket_id;
    const channelName = req.body.channel_name;
    const userId = req.user?.userId;

    if (!socketId || !channelName) {
      res.status(400).json({ error: 'Missing socket_id or channel_name' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Extract board ID from channel name (format: private-board-{boardId})
    const boardIdMatch = channelName.match(/^private-board-(.+)$/);
    
    if (!boardIdMatch) {
      logger.warn(`[Pusher Auth] Invalid channel format: ${channelName}`);
      res.status(403).json({ error: 'Invalid channel name' });
      return;
    }

    const boardId = boardIdMatch[1];

    // Validate boardId format
    if (!mongoose.Types.ObjectId.isValid(boardId)) {
      logger.warn(`[Pusher Auth] Invalid boardId format: ${boardId}`);
      res.status(403).json({ error: 'Invalid board ID' });
      return;
    }

    // Check if user has access to the board
    const board = await Board.findById(boardId);
    
    if (!board) {
      logger.warn(`[Pusher Auth] Board not found: ${boardId}`);
      res.status(404).json({ error: 'Board not found' });
      return;
    }

    // Check if user is the creator or a member
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const isCreator = board.createdBy.toString() === userObjectId.toString();
    const isMember = board.members.some(memberId => memberId.toString() === userObjectId.toString());

    if (!isCreator && !isMember) {
      logger.warn(`[Pusher Auth] Access denied: User ${userId} attempted to join board: ${boardId}`);
      res.status(403).json({ error: 'Access denied: You are not a member of this board' });
      return;
    }

    const pusher = getPusher();

    const auth = pusher.authorizeChannel(socketId, channelName);
    
    logger.info(`[Pusher Auth] User ${userId} authorized for channel: ${channelName}`);
    res.json(auth);
  } catch (error) {
    logger.error('[Pusher Auth] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
