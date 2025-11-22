import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import logger from './logger';
import { Board, IBoard } from '../models/Board';
import { IList } from '../models/List';
import { ITask } from '../models/Task';

// Socket event data types
interface SocketErrorData {
  message: string;
}

interface JoinedBoardData {
  boardId: string;
}

interface ListDeletedData {
  listId: string;
}

interface TaskDeletedData {
  taskId: string;
}

interface BoardMemberChangedData {
  userId: string;
}

let io: SocketIOServer | null = null;

// CORS configuration for Socket.IO
const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'https://task-flow-web-tawny.vercel.app',
  ];

  // Add custom origin from environment variable if provided
  if (process.env.CLIENT_URL) {
    origins.push(process.env.CLIENT_URL);
  }

  return origins;
};

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();
    
    if (!origin) {
      return callback(null, true);
    }

    // Check if the origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } 
    // Allow task-flow-web Vercel deployments
    else if (origin.match(/^https:\/\/task-flow-web.*\.vercel\.app$/)) {
      callback(null, true);
    } 
    else {
      logger.warn(`[Socket] Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
};

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: corsOptions,
  });

  // Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token;
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!token) {
      logger.warn('[Socket] Connection rejected: No token provided');
      return next(new Error('Authentication error: No token provided'));
    }
    
    if (!jwtSecret) {
      logger.error('[Socket] JWT_SECRET is not defined');
      return next(new Error('Server configuration error'));
    }

    try {
      const decoded = jwt.verify(token, jwtSecret) as { userId: string };
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
          socket.emit('error', { message: 'Invalid board ID format' } as SocketErrorData);
          return;
        }

        // Check if user has access to the board
        const board: IBoard | null = await Board.findById(boardId);
        
        if (!board) {
          logger.warn(`[Socket] Board not found: ${boardId}, User: ${userId}`);
          socket.emit('error', { message: 'Board not found' } as SocketErrorData);
          return;
        }

        // Check if user is the creator or a member
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const isCreator = board.createdBy.toString() === userObjectId.toString();
        const isMember = board.members.some(memberId => memberId.toString() === userObjectId.toString());

        if (!isCreator && !isMember) {
          logger.warn(`[Socket] Access denied: User ${userId} attempted to join board:${boardId}`);
          socket.emit('error', { message: 'Access denied: You are not a member of this board' } as SocketErrorData);
          return;
        }

        // Authorization successful - join the room
        socket.join(`board:${boardId}`);
        logger.info(`[Socket] User ${userId} joined board:${boardId} (authorized)`);
        socket.emit('joined-board', { boardId } as JoinedBoardData);
      } catch (error) {
        logger.error(`[Socket] Error joining board:`, error);
        socket.emit('error', { message: 'Failed to join board' } as SocketErrorData);
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
export const emitToBoardRoom = (boardId: string, event: string, data: unknown): void => {
  if (!io) {
    logger.warn(`[Socket] Attempted to emit ${event} to board:${boardId} but Socket.IO not initialized`);
    return;
  }
  io.to(`board:${boardId}`).emit(event, data);
  logger.info(`[Socket] Emitted ${event} to board:${boardId}`, { data });
};

export const emitListCreated = (boardId: string, list: IList): void => {
  emitToBoardRoom(boardId, 'list:created', list);
};

export const emitListUpdated = (boardId: string, list: IList): void => {
  emitToBoardRoom(boardId, 'list:updated', list);
};

export const emitListDeleted = (boardId: string, listId: string): void => {
  emitToBoardRoom(boardId, 'list:deleted', { listId } as ListDeletedData);
};

export const emitTaskCreated = (boardId: string, task: ITask): void => {
  emitToBoardRoom(boardId, 'task:created', task);
};

export const emitTaskUpdated = (boardId: string, task: ITask): void => {
  emitToBoardRoom(boardId, 'task:updated', task);
};

export const emitTaskDeleted = (boardId: string, taskId: string): void => {
  emitToBoardRoom(boardId, 'task:deleted', { taskId } as TaskDeletedData);
};

export const emitBoardUpdated = (boardId: string, board: IBoard): void => {
  emitToBoardRoom(boardId, 'board:updated', board);
};

export const emitBoardMemberAdded = (boardId: string, userId: string): void => {
  emitToBoardRoom(boardId, 'board:member-added', { userId } as BoardMemberChangedData);
};

export const emitBoardMemberRemoved = (boardId: string, userId: string): void => {
  emitToBoardRoom(boardId, 'board:member-removed', { userId } as BoardMemberChangedData);
};
