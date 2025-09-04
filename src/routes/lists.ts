import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { List, IList } from '../models/List';
import { Task } from '../models/Task';
import { Board, IBoard } from '../models/Board';
import mongoose from 'mongoose';

const router = express.Router({ mergeParams: true });

// Update list
router.put('/:listId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[PUT /lists/:listId] Updating list ${req.params.listId}`);
    const list = await List.findById(req.params.listId);
    if (!list) {
      console.log(`[PUT /lists/:listId] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId);
    if (!board) {
      console.log(`[PUT /lists/:listId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    const userId = req.user?.userId;
    if (!userId || (!board.members.includes(userId) && board.createdBy.toString() !== userId.toString())) {
      console.log(`[PUT /lists/:listId] Access denied for user ${userId} to update list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedList = await List.findByIdAndUpdate(
      req.params.listId,
      { $set: req.body },
      { new: true }
    );
    console.log(`[PUT /lists/:listId] Successfully updated list ${updatedList?._id}`);
    res.json(updatedList);
    
  } catch (error) {
    console.error(`[PUT /lists/:listId] Error updating list:`, error);
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
    console.log(`[DELETE /lists/:listId] Deleting list ${req.params.listId}`);
    const list = await List.findById(req.params.listId);
    if (!list) {
      console.log(`[DELETE /lists/:listId] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId);
    if (!board) {
      console.log(`[DELETE /lists/:listId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    const userId = req.user?.userId;
    if (!userId || (!board.members.includes(userId) && board.createdBy.toString() !== userId.toString())) {
      console.log(`[DELETE /lists/:listId] Access denied for user ${userId} to delete list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete all tasks in the list
    const deletedTasks = await Task.deleteMany({ listId: list._id });
    await list.deleteOne();

    console.log(`[DELETE /lists/:listId] Successfully deleted list ${list._id} and ${deletedTasks.deletedCount} tasks`);
    res.json({ message: 'List deleted successfully' });
  } catch (error) {
    console.error(`[DELETE /lists/:listId] Error deleting list:`, error);
    res.status(500).json({ message: 'Error deleting list' });
  }
});

// Update list position
router.put('/:listId/position', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[PUT /lists/:listId/position] Updating position for list ${req.params.listId} to ${req.body.position}`);
    const { position } = req.body;
    if (typeof position !== 'number') {
      console.log(`[PUT /lists/:listId/position] Invalid position value provided: ${position}`);
      return res.status(400).json({ message: 'Invalid position value' });
    }

    const list = await List.findById(req.params.listId) as IList;
    if (!list) {
      console.log(`[PUT /lists/:listId/position] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      console.log(`[PUT /lists/:listId/position] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[PUT /lists/:listId/position] Access denied for user ${req.user!.userId} to update list position`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all lists in the board to reorder
    const lists = await List.find({ boardId: board._id }).sort('position');
    
    // Remove the list from its current position
    const currentIndex = lists.findIndex(l => l._id!.toString() === (list._id!.toString()));
    if (currentIndex !== -1) {
      lists.splice(currentIndex, 1);
    }

    // Insert the list at the new position
    lists.splice(position, 0, list.toObject());

    // Update positions
    await Promise.all(lists.map((l, index) => {
      return List.findByIdAndUpdate(l._id, { position: index });
    }));

    console.log(`[PUT /lists/:listId/position] Successfully updated position for list ${list._id} to ${position}`);
    res.json({ message: 'List position updated successfully' });
  } catch (error) {
    console.error(`[PUT /lists/:listId/position] Error updating list position:`, error);
    res.status(500).json({ message: 'Error updating list position' });
  }
});

// Get all tasks in a list
router.get('/:listId/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[GET /lists/:listId/tasks] Fetching tasks for list ${req.params.listId}`);
    const list = await List.findById(req.params.listId) as IList;
    if (!list) {
      console.log(`[GET /lists/:listId/tasks] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      console.log(`[GET /lists/:listId/tasks] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[GET /lists/:listId/tasks] Access denied for user ${req.user!.userId} to view tasks in list ${list._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const tasks = await Task.find({ listId: list._id }).sort('position');
    console.log(`[GET /lists/:listId/tasks] Successfully fetched ${tasks.length} tasks from list ${list._id}`);
    res.json(tasks);
  } catch (error) {
    console.error(`[GET /lists/:listId/tasks] Error fetching tasks:`, error);
    res.status(500).json({ message: 'Error fetching tasks' });
  }
});

// Create new task
router.post('/:listId/tasks', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[POST /lists/:listId/tasks] Creating new task in list ${req.params.listId}`);
    const list = await List.findById(req.params.listId) as IList;
    if (!list) {
      console.log(`[POST /lists/:listId/tasks] List ${req.params.listId} not found`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      console.log(`[POST /lists/:listId/tasks] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[POST /lists/:listId/tasks] Access denied for user ${req.user!.userId} to create task in list ${list._id}`);
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
    console.log(`[POST /lists/:listId/tasks] Successfully created task ${task._id} in list ${list._id}`);
    res.status(201).json(task);
  } catch (error) {
    console.error(`[POST /lists/:listId/tasks] Error creating task:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ message: 'Invalid task data' });
    } else {
        res.status(500).json({ message: 'Error creating task' });
    }
  }
});

export default router;
