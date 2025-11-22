import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import logger from './logger';
import { Board } from '../models/Board';

let io: SocketIOServer | null = null;

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      logger.warn('[Socket] Connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.data.userId = decoded.userId;
      logger.info(`[Socket] User ${decoded.userId} authenticated`);
      next();
    } catch (error) {
      logger.error('[Socket] Authentication error:', error);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    logger.info(`[Socket] Client connected: ${socket.id}, User: ${userId}`);

    // Join board room with authorization check
    socket.on('join-board', async (boardId: string) => {
      try {
        // Validate boardId format
        if (!mongoose.Types.ObjectId.isValid(boardId)) {
          logger.warn(`[Socket] Invalid boardId format: ${boardId}, User: ${userId}`);
          socket.emit('error', { message: 'Invalid board ID format' });
          return;
        }

        // Check if user has access to the board
        const board = await Board.findById(boardId);
        
        if (!board) {
          logger.warn(`[Socket] Board not found: ${boardId}, User: ${userId}`);
          socket.emit('error', { message: 'Board not found' });
          return;
        }

        // Check if user is the creator or a member
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const isCreator = board.createdBy.toString() === userObjectId.toString();
        const isMember = board.members.some(memberId => memberId.toString() === userObjectId.toString());

        if (!isCreator && !isMember) {
          logger.warn(`[Socket] Access denied: User ${userId} attempted to join board:${boardId}`);
          socket.emit('error', { message: 'Access denied: You are not a member of this board' });
          return;
        }

        // Authorization successful - join the room
        socket.join(`board:${boardId}`);
        logger.info(`[Socket] User ${userId} joined board:${boardId} (authorized)`);
        socket.emit('joined-board', { boardId });
      } catch (error) {
        logger.error(`[Socket] Error joining board:`, error);
        socket.emit('error', { message: 'Failed to join board' });
      }
    });

    // Leave board room
    socket.on('leave-board', (boardId: string) => {
      socket.leave(`board:${boardId}`);
      logger.info(`[Socket] User ${userId} left board:${boardId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket] Client disconnected: ${socket.id}, User: ${userId}`);
    });
  });

  logger.info('[Socket] Socket.IO server initialized');
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
  return io;
};

// Helper functions to emit events to board rooms
export const emitToBoardRoom = (boardId: string, event: string, data: any) => {
  if (io) {
    io.to(`board:${boardId}`).emit(event, data);
    logger.info(`[Socket] Emitted ${event} to board:${boardId}`, { data });
  }
};

export const emitListCreated = (boardId: string, list: any) => {
  emitToBoardRoom(boardId, 'list:created', list);
};

export const emitListUpdated = (boardId: string, list: any) => {
  emitToBoardRoom(boardId, 'list:updated', list);
};

export const emitListDeleted = (boardId: string, listId: string) => {
  emitToBoardRoom(boardId, 'list:deleted', { listId });
};

export const emitTaskCreated = (boardId: string, task: any) => {
  emitToBoardRoom(boardId, 'task:created', task);
};

export const emitTaskUpdated = (boardId: string, task: any) => {
  emitToBoardRoom(boardId, 'task:updated', task);
};

export const emitTaskDeleted = (boardId: string, taskId: string) => {
  emitToBoardRoom(boardId, 'task:deleted', { taskId });
};

export const emitBoardUpdated = (boardId: string, board: any) => {
  emitToBoardRoom(boardId, 'board:updated', board);
};

export const emitBoardMemberAdded = (boardId: string, userId: string) => {
  emitToBoardRoom(boardId, 'board:member-added', { userId });
};

export const emitBoardMemberRemoved = (boardId: string, userId: string) => {
  emitToBoardRoom(boardId, 'board:member-removed', { userId });
};
