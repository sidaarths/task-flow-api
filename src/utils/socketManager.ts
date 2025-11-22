import Pusher from 'pusher';
import logger from './logger';
import { IBoard } from '../models/Board';
import { IList } from '../models/List';
import { ITask } from '../models/Task';

let pusher: Pusher | null = null;

// Helper function to generate channel name consistently
const getChannelName = (boardId: string): string => `private-board-${boardId}`;

// Initialize Pusher
export const initializePusher = (): Pusher => {
  if (pusher) {
    return pusher;
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || 'us2';

  if (!appId || !key || !secret) {
    logger.error('[Pusher] Missing required environment variables');
    throw new Error('Pusher configuration error: Missing environment variables');
  }

  pusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  logger.info('[Pusher] Initialized successfully');
  return pusher;
};

// Get Pusher instance
export const getPusher = (): Pusher => {
  if (!pusher) {
    throw new Error('Pusher not initialized. Call initializePusher first.');
  }
  return pusher;
};

// Trigger event on board channel
const triggerBoardEvent = (boardId: string, event: string, data: unknown): void => {
  try {
    const pusherInstance = getPusher();
    const channelName = getChannelName(boardId);
    pusherInstance.trigger(channelName, event, data);
    logger.info(`[Pusher] Triggered ${event} on ${channelName}`, { data });
  } catch (error) {
    logger.error(`[Pusher] Error triggering ${event} on board-${boardId}:`, error);
  }
};

// List events
export const emitListCreated = (boardId: string, list: IList): void => {
  triggerBoardEvent(boardId, 'list:created', list);
};

export const emitListUpdated = (boardId: string, list: IList): void => {
  triggerBoardEvent(boardId, 'list:updated', list);
};

export const emitListDeleted = (boardId: string, listId: string): void => {
  triggerBoardEvent(boardId, 'list:deleted', { listId });
};

// Task events
export const emitTaskCreated = (boardId: string, task: ITask): void => {
  triggerBoardEvent(boardId, 'task:created', task);
};

export const emitTaskUpdated = (boardId: string, task: ITask): void => {
  triggerBoardEvent(boardId, 'task:updated', task);
};

export const emitTaskDeleted = (boardId: string, taskId: string): void => {
  triggerBoardEvent(boardId, 'task:deleted', { taskId });
};

// Board events
export const emitBoardUpdated = (boardId: string, board: IBoard): void => {
  triggerBoardEvent(boardId, 'board:updated', board);
};

export const emitBoardMemberAdded = (boardId: string, userId: string): void => {
  triggerBoardEvent(boardId, 'board:member-added', { userId });
};

export const emitBoardMemberRemoved = (boardId: string, userId: string): void => {
  triggerBoardEvent(boardId, 'board:member-removed', { userId });
};
