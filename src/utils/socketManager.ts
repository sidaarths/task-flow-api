import Pusher from 'pusher';
import logger from './logger';
import { IBoard } from '../models/Board';
import { IList } from '../models/List';
import { ITask } from '../models/Task';

let pusher: Pusher | null = null;

export const initializePusher = (): Pusher => {
  if (pusher) {
    return pusher;
  }

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || 'us2';

  if (!appId || !key || !secret) {
    logger.error('[Pusher] Missing required environment variables (PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET)');
    throw new Error('Pusher configuration error: Missing environment variables');
  }

  pusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  logger.info('[Pusher] Pusher initialized successfully');
  return pusher;
};

export const getPusher = (): Pusher => {
  if (!pusher) {
    throw new Error('Pusher not initialized. Call initializePusher first.');
  }
  return pusher;
};

// Helper functions to emit events to board channels
const triggerBoardEvent = (boardId: string, event: string, data: unknown): void => {
  try {
    const pusherInstance = getPusher();
    pusherInstance.trigger(`private-board-${boardId}`, event, data);
    logger.info(`[Pusher] Triggered ${event} on board-${boardId}`, { data });
  } catch (error) {
    logger.error(`[Pusher] Error triggering ${event} on board-${boardId}:`, error);
  }
};

export const emitListCreated = (boardId: string, list: IList): void => {
  triggerBoardEvent(boardId, 'list:created', list);
};

export const emitListUpdated = (boardId: string, list: IList): void => {
  triggerBoardEvent(boardId, 'list:updated', list);
};

export const emitListDeleted = (boardId: string, listId: string): void => {
  triggerBoardEvent(boardId, 'list:deleted', { listId });
};

export const emitTaskCreated = (boardId: string, task: ITask): void => {
  triggerBoardEvent(boardId, 'task:created', task);
};

export const emitTaskUpdated = (boardId: string, task: ITask): void => {
  triggerBoardEvent(boardId, 'task:updated', task);
};

export const emitTaskDeleted = (boardId: string, taskId: string): void => {
  triggerBoardEvent(boardId, 'task:deleted', { taskId });
};

export const emitBoardUpdated = (boardId: string, board: IBoard): void => {
  triggerBoardEvent(boardId, 'board:updated', board);
};

export const emitBoardMemberAdded = (boardId: string, userId: string): void => {
  triggerBoardEvent(boardId, 'board:member-added', { userId });
};

export const emitBoardMemberRemoved = (boardId: string, userId: string): void => {
  triggerBoardEvent(boardId, 'board:member-removed', { userId });
};
