import { Response } from 'express';
import logger from './logger';
import { IList } from '../models/List';
import { ITask } from '../models/Task';
import { IBoard } from '../models/Board';

interface SSEClient {
  res: Response;
  userId: string;
  boardId: string;
  connectedAt: Date;
}

// boardId -> Set of connected clients
const sseClients = new Map<string, Set<SSEClient>>();

export const addSSEClient = (boardId: string, client: SSEClient): void => {
  if (!sseClients.has(boardId)) {
    sseClients.set(boardId, new Set());
  }
  sseClients.get(boardId)!.add(client);
  logger.info(`[SSE] Client connected to board ${boardId}. Total: ${sseClients.get(boardId)!.size}`);
};

export const removeSSEClient = (boardId: string, client: SSEClient): void => {
  const clients = sseClients.get(boardId);
  if (clients) {
    clients.delete(client);
    if (clients.size === 0) {
      sseClients.delete(boardId);
    }
    logger.info(`[SSE] Client disconnected from board ${boardId}. Remaining: ${clients.size}`);
  }
};

export const getClientCount = (boardId: string): number =>
  sseClients.get(boardId)?.size ?? 0;

const formatSSEMessage = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const broadcastToBoardClients = (boardId: string, event: string, data: unknown): void => {
  const clients = sseClients.get(boardId);
  if (!clients || clients.size === 0) return;

  const message = formatSSEMessage(event, data);
  const deadClients: SSEClient[] = [];

  clients.forEach((client) => {
    try {
      client.res.write(message);
    } catch {
      deadClients.push(client);
    }
  });

  deadClients.forEach((c) => removeSSEClient(boardId, c));

  if (clients.size > 0) {
    logger.debug(`[SSE] Broadcast "${event}" to ${clients.size} client(s) on board ${boardId}`);
  }
};

// List events — same export names as old socketManager.ts
export const emitListCreated = (boardId: string, list: IList): void =>
  broadcastToBoardClients(boardId, 'list:created', list);

export const emitListUpdated = (boardId: string, list: IList): void =>
  broadcastToBoardClients(boardId, 'list:updated', list);

export const emitListDeleted = (boardId: string, listId: string): void =>
  broadcastToBoardClients(boardId, 'list:deleted', { listId });

// Task events
export const emitTaskCreated = (boardId: string, task: ITask): void =>
  broadcastToBoardClients(boardId, 'task:created', task);

export const emitTaskUpdated = (boardId: string, task: ITask): void =>
  broadcastToBoardClients(boardId, 'task:updated', task);

export const emitTaskDeleted = (boardId: string, taskId: string): void =>
  broadcastToBoardClients(boardId, 'task:deleted', { taskId });

// Bulk-reorder events (sent after any position change so ALL clients sync)
export const emitListReordered = (
  boardId: string,
  lists: Array<{ _id: string; position: number }>
): void => broadcastToBoardClients(boardId, 'list:reordered', lists);

export const emitTaskReordered = (
  boardId: string,
  tasks: Array<{ _id: string; position: number; listId: string }>
): void => broadcastToBoardClients(boardId, 'task:reordered', tasks);

// Board events
export const emitBoardUpdated = (boardId: string, board: IBoard): void =>
  broadcastToBoardClients(boardId, 'board:updated', board);

export const emitBoardMemberAdded = (boardId: string, userId: string): void =>
  broadcastToBoardClients(boardId, 'board:member-added', { userId });

export const emitBoardMemberRemoved = (boardId: string, userId: string): void =>
  broadcastToBoardClients(boardId, 'board:member-removed', { userId });
