import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { List, IList } from '../models/List';
import { Task } from '../models/Task';
import { Board, IBoard } from '../models/Board';
import mongoose from 'mongoose';
import logger from '../utils/logger';

const router = express.Router({ mergeParams: true });

// Update list
router.put('/:listId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[PUT /lists/:listId] Updating list ${req.params.listId}`);
    const list = await List.findById(req.params.listId);
    if (!list) {
      logger.warn(`[PUT /lists/:listId] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId);
    if (!board) {
      logger.warn(`[PUT /lists/:listId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    const userId = req.user?.userId;
    if (!userId || (!board.members.includes(userId) && board.createdBy.toString() !== userId.toString())) {
      logger.warn(`[PUT /lists/:listId] Access denied for user ${userId} to update list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove protected fields from the update
    const { position, ...updateData } = req.body;
    if (position !== undefined) {
      logger.warn(`[PUT /lists/:listId] Ignored position field - use /position endpoint instead`);
    }

    const updatedList = await List.findByIdAndUpdate(
      req.params.listId,
      { $set: updateData },
      { new: true }
    );
    logger.info(`[PUT /lists/:listId] Successfully updated list ${updatedList?._id}`);
    res.json(updatedList);
    
  } catch (error) {
    logger.error(`[PUT /lists/:listId] Error updating list:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ message: 'Invalid list data' });
    } else {
        res.status(500).json({ message: 'Error updating list' });
    }
  }
});

// Delete list
router.delete('/:listId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[DELETE /lists/:listId] Deleting list ${req.params.listId}`);
    const list = await List.findById(req.params.listId);
    if (!list) {
      logger.warn(`[DELETE /lists/:listId] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId);
    if (!board) {
      logger.warn(`[DELETE /lists/:listId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    const userId = req.user?.userId;
    if (!userId || (!board.members.includes(userId) && board.createdBy.toString() !== userId.toString())) {
      logger.warn(`[DELETE /lists/:listId] Access denied for user ${userId} to delete list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete all tasks in the list
    const deletedTasks = await Task.deleteMany({ listId: list._id });
    await list.deleteOne();

    logger.info(`[DELETE /lists/:listId] Successfully deleted list ${list._id} and ${deletedTasks.deletedCount} tasks`);
    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    logger.error(`[DELETE /lists/:listId] Error deleting list:`, error);
    res.status(500).json({ message: 'Error deleting list' });
  }
});

// Update list position
router.put('/:listId/position', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[PUT /lists/:listId/position] Updating position for list ${req.params.listId} to ${req.body.position}`);
    const { position } = req.body;
    if (typeof position !== 'number') {
      logger.warn(`[PUT /lists/:listId/position] Invalid position value provided: ${position}`);
      return res.status(400).json({ message: 'Invalid position value' });
    }

    const list = await List.findById(req.params.listId) as IList;
    if (!list) {
      logger.warn(`[PUT /lists/:listId/position] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[PUT /lists/:listId/position] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[PUT /lists/:listId/position] Access denied for user ${req.user!.userId} to update list position`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all lists in the board to reorder
    const lists = await List.find({ boardId: board._id }).sort('position');
    
    // Remove the list from its current position
    const currentIndex = lists.findIndex(l => l._id!.toString() === (list._id!.toString()));
    if (currentIndex !== -1) {
      lists.splice(currentIndex, 1);
    }

    // Clamp the position between 0 and the list length
    const clampedPosition = Math.max(0, Math.min(position, lists.length));
    if (clampedPosition !== position) {
      logger.warn(`[PUT /lists/:listId/position] Clamped position from ${position} to ${clampedPosition}`);
    }

    // Insert the list at the new position
    lists.splice(clampedPosition, 0, list.toObject());

    // Update positions
    await Promise.all(lists.map((l, index) => {
      return List.findByIdAndUpdate(l._id, { position: index });
    }));

    logger.info(`[PUT /lists/:listId/position] Successfully updated position for list ${list._id} to ${position}`);
    res.json({ message: 'List position updated successfully' });
  } catch (error) {
    logger.error(`[PUT /lists/:listId/position] Error updating list position:`, error);
    res.status(500).json({ message: 'Error updating list position' });
  }
});

// Get all tasks in a list
router.get('/:listId/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[GET /lists/:listId/tasks] Fetching tasks for list ${req.params.listId}`);
    const list = await List.findById(req.params.listId) as IList;
    if (!list) {
      logger.warn(`[GET /lists/:listId/tasks] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[GET /lists/:listId/tasks] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[GET /lists/:listId/tasks] Access denied for user ${req.user!.userId} to view tasks in list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const tasks = await Task.find({ listId: list._id }).sort('position');
    logger.info(`[GET /lists/:listId/tasks] Successfully fetched ${tasks.length} tasks from list ${list._id}`);
    res.json(tasks);
  } catch (error) {
    logger.error(`[GET /lists/:listId/tasks] Error fetching tasks:`, error);
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// Create new task
router.post('/:listId/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[POST /lists/:listId/tasks] Creating new task in list ${req.params.listId}`);
    const list = await List.findById(req.params.listId) as IList;
    if (!list) {
      logger.warn(`[POST /lists/:listId/tasks] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[POST /lists/:listId/tasks] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[POST /lists/:listId/tasks] Access denied for user ${req.user!.userId} to create task in list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const lastTask = await Task.findOne({ listId: list._id }).sort('-position');
    const position = lastTask ? lastTask.position + 1 : 0;

    const task = new Task({
      ...req.body,
      listId: list._id,
      position,
      createdBy: req.user!.userId
    });

    await task.save();
    logger.info(`[POST /lists/:listId/tasks] Successfully created task ${task._id} in list ${list._id}`);
    res.status(201).json(task);
  } catch (error) {
    logger.error(`[POST /lists/:listId/tasks] Error creating task:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ message: 'Invalid task data' });
    } else {
        res.status(500).json({ message: 'Error creating task' });
    }
  }
});

export default router;
