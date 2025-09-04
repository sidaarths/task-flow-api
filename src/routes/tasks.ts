import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Task, ITask } from '../models/Task';
import { List, IList } from '../models/List';
import { Board, IBoard } from '../models/Board';
import mongoose from 'mongoose';

const router = express.Router({ mergeParams: true });

// Get specific task details
router.get('/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[GET /tasks/:taskId] Fetching task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      console.log(`[GET /tasks/:taskId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      console.log(`[GET /tasks/:taskId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      console.log(`[GET /tasks/:taskId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[GET /tasks/:taskId] Access denied for user ${req.user!.userId} to view task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    console.log(`[GET /tasks/:taskId] Successfully fetched task ${task._id}`);
    res.json(task);
  } catch (error) {
    console.error(`[GET /tasks/:taskId] Error fetching task details:`, error);
    res.status(500).json({ message: 'Error fetching task details' });
  }
});

// Update task
router.put('/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[PUT /tasks/:taskId] Updating task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      console.log(`[PUT /tasks/:taskId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      console.log(`[PUT /tasks/:taskId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      console.log(`[PUT /tasks/:taskId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[PUT /tasks/:taskId] Access denied for user ${req.user!.userId} to update task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.taskId,
      { $set: req.body },
      { new: true }
    );
    console.log(`[PUT /tasks/:taskId] Successfully updated task ${updatedTask?._id}`);
    res.json(updatedTask);
  } catch (error) {
    console.error(`[PUT /tasks/:taskId] Error updating task:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ message: 'Invalid task data' });
    } else {
        res.status(500).json({ message: 'Error updating task' });
    }
  }
});

// Delete task
router.delete('/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[DELETE /tasks/:taskId] Deleting task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      console.log(`[DELETE /tasks/:taskId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      console.log(`[DELETE /tasks/:taskId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      console.log(`[DELETE /tasks/:taskId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[DELETE /tasks/:taskId] Access denied for user ${req.user!.userId} to delete task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    await task.deleteOne();
    console.log(`[DELETE /tasks/:taskId] Successfully deleted task ${task._id}`);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error(`[DELETE /tasks/:taskId] Error deleting task:`, error);
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// Update task position
router.put('/:taskId/position', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { listId, position } = req.body;
    console.log(`[PUT /tasks/:taskId/position] Updating position for task ${req.params.taskId} to position ${position}${listId ? ` in list ${listId}` : ''}`);

    if (typeof position !== 'number') {
      console.log(`[PUT /tasks/:taskId/position] Invalid position value provided: ${position}`);
      return res.status(400).json({ message: 'Invalid position value' });
    }

    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      console.log(`[PUT /tasks/:taskId/position] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get source and target lists
    const sourceList = await List.findById(task.listId) as IList;
    const targetList = listId ? await List.findById(listId) as IList : sourceList;
    
    if (!sourceList || (listId && !targetList)) {
      console.log(`[PUT /tasks/:taskId/position] List not found - Source: ${task.listId}, Target: ${listId}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(sourceList.boardId) as IBoard;
    if (!board || (targetList && targetList.boardId.toString() !== board._id!.toString())) {
      console.log(`[PUT /tasks/:taskId/position] Board ${sourceList.boardId} not found or lists belong to different boards`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[PUT /tasks/:taskId/position] Access denied for user ${req.user!.userId} to update task position`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update task's list if moving to a different list
    if (listId && listId !== task.listId.toString()) {
      console.log(`[PUT /tasks/:taskId/position] Moving task from list ${task.listId} to list ${listId}`);
      task.listId = new mongoose.Types.ObjectId(listId);
    }

    // Get all tasks in the target list
    const tasks = await Task.find({ listId: targetList._id }).sort('position') as ITask[];
    
    // Remove the task from its current position
    const currentIndex = tasks.findIndex(t => t._id!.toString() === task._id!.toString());
    if (currentIndex !== -1) {
      tasks.splice(currentIndex, 1);
    }

    // Insert task at the new position
    tasks.splice(position, 0, task);

    // Update positions
    await Promise.all(tasks.map((t, index) => {
      return Task.findByIdAndUpdate(t._id, { 
        position: index,
        listId: targetList._id 
      });
    }));

    console.log(`[PUT /tasks/:taskId/position] Successfully updated position for task ${task._id} to ${position} in list ${targetList._id}`);
    res.json({ message: 'Task position updated successfully' });
  } catch (error) {
    console.error(`[PUT /tasks/:taskId/position] Error updating task position:`, error);
    res.status(500).json({ message: 'Error updating task position' });
  }
});

export default router;
