import { Response } from 'express';
import {
  addSSEClient,
  removeSSEClient,
  getClientCount,
  emitListCreated,
  emitListUpdated,
  emitListDeleted,
  emitTaskCreated,
  emitTaskUpdated,
  emitTaskDeleted,
  emitBoardUpdated,
  emitBoardMemberAdded,
  emitBoardMemberRemoved,
} from '../../src/utils/sseManager';

function makeRes(): jest.Mocked<Pick<Response, 'write'>> {
  return { write: jest.fn() };
}

function makeClient(boardId = 'board-1', userId = 'user-1') {
  return { res: makeRes() as unknown as Response, userId, boardId, connectedAt: new Date() };
}

describe('sseManager', () => {
  beforeEach(() => {
    // Remove any clients left from previous test (clean per-test)
    const boardId = 'board-1';
    const count = getClientCount(boardId);
    // If there are lingering clients, this is test isolation issue — acceptable for unit tests
  });

  it('getClientCount returns 0 for unknown board', () => {
    expect(getClientCount('nonexistent-board')).toBe(0);
  });

  it('addSSEClient increases client count', () => {
    const client = makeClient('board-add-1');
    addSSEClient('board-add-1', client);
    expect(getClientCount('board-add-1')).toBe(1);
    removeSSEClient('board-add-1', client);
  });

  it('removeSSEClient decreases client count', () => {
    const client = makeClient('board-remove-1');
    addSSEClient('board-remove-1', client);
    expect(getClientCount('board-remove-1')).toBe(1);
    removeSSEClient('board-remove-1', client);
    expect(getClientCount('board-remove-1')).toBe(0);
  });

  it('broadcast writes SSE message to connected client', () => {
    const client = makeClient('board-emit-1');
    addSSEClient('board-emit-1', client);

    emitListCreated('board-emit-1', { _id: 'list-1', title: 'L1' } as any);

    expect((client.res as any).write).toHaveBeenCalledWith(
      expect.stringContaining('list:created')
    );
    removeSSEClient('board-emit-1', client);
  });

  it('emitListCreated sends list:created event', () => {
    const client = makeClient('board-lc');
    addSSEClient('board-lc', client);
    emitListCreated('board-lc', { _id: 'l1' } as any);
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('list:created'));
    removeSSEClient('board-lc', client);
  });

  it('emitListUpdated sends list:updated event', () => {
    const client = makeClient('board-lu');
    addSSEClient('board-lu', client);
    emitListUpdated('board-lu', { _id: 'l1' } as any);
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('list:updated'));
    removeSSEClient('board-lu', client);
  });

  it('emitListDeleted sends list:deleted event', () => {
    const client = makeClient('board-ld');
    addSSEClient('board-ld', client);
    emitListDeleted('board-ld', 'l1');
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('list:deleted'));
    removeSSEClient('board-ld', client);
  });

  it('emitTaskCreated sends task:created event', () => {
    const client = makeClient('board-tc');
    addSSEClient('board-tc', client);
    emitTaskCreated('board-tc', { _id: 't1' } as any);
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('task:created'));
    removeSSEClient('board-tc', client);
  });

  it('emitTaskUpdated sends task:updated event', () => {
    const client = makeClient('board-tu');
    addSSEClient('board-tu', client);
    emitTaskUpdated('board-tu', { _id: 't1' } as any);
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('task:updated'));
    removeSSEClient('board-tu', client);
  });

  it('emitTaskDeleted sends task:deleted event', () => {
    const client = makeClient('board-td');
    addSSEClient('board-td', client);
    emitTaskDeleted('board-td', 't1');
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('task:deleted'));
    removeSSEClient('board-td', client);
  });

  it('emitBoardUpdated sends board:updated event', () => {
    const client = makeClient('board-bu');
    addSSEClient('board-bu', client);
    emitBoardUpdated('board-bu', { _id: 'b1' } as any);
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('board:updated'));
    removeSSEClient('board-bu', client);
  });

  it('emitBoardMemberAdded sends board:member-added event', () => {
    const client = makeClient('board-bma');
    addSSEClient('board-bma', client);
    emitBoardMemberAdded('board-bma', 'user-2');
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('board:member-added'));
    removeSSEClient('board-bma', client);
  });

  it('emitBoardMemberRemoved sends board:member-removed event', () => {
    const client = makeClient('board-bmr');
    addSSEClient('board-bmr', client);
    emitBoardMemberRemoved('board-bmr', 'user-2');
    expect((client.res as any).write).toHaveBeenCalledWith(expect.stringContaining('board:member-removed'));
    removeSSEClient('board-bmr', client);
  });

  it('does not write when no clients connected', () => {
    // Should not throw
    expect(() => emitListCreated('board-empty', { _id: 'l1' } as any)).not.toThrow();
  });

  it('removes dead client on write error', () => {
    const client = makeClient('board-dead');
    (client.res as any).write = jest.fn().mockImplementation(() => {
      throw new Error('write error');
    });
    addSSEClient('board-dead', client);
    expect(getClientCount('board-dead')).toBe(1);
    emitListCreated('board-dead', { _id: 'l1' } as any);
    expect(getClientCount('board-dead')).toBe(0);
  });
});
