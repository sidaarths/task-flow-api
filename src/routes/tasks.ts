import express, { Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { Task, ITask } from '../models/Task';
import { List, IList } from '../models/List';
import { Board, IBoard } from '../models/Board';
import mongoose from 'mongoose';
import logger from '../utils/logger';

const router = express.Router({ mergeParams: true });

// Assign member to task
router.post('/:taskId/users/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[POST /tasks/:taskId/users/:userId] Assigning member ${req.params.userId} to task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[POST /tasks/:taskId/users/:userId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      logger.warn(`[POST /tasks/:taskId/users/:userId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[POST /tasks/:taskId/users/:userId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[POST /tasks/:taskId/users/:userId] Access denied for user ${req.user!.userId} to assign task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const assigneeId = new mongoose.Types.ObjectId(req.params.userId);

    // Check if member is a board member
    if (!board.members.includes(assigneeId) && board.createdBy.toString() !== assigneeId.toString()) {
      logger.warn(`[POST /tasks/:taskId/users/:userId] Member ${req.params.userId} is not a member of the board`);
      return res.status(400).json({ message: 'Member must be a board member to be assigned to a task' });
    }

    // Check if member is already assigned
    if (task.assignedTo.some(id => id.toString() === assigneeId.toString())) {
      logger.warn(`[POST /tasks/:taskId/users/:userId] Member ${req.params.userId} is already assigned to task ${task._id}`);
      return res.status(400).json({ message: 'Member is already assigned to this task' });
    }

    task.assignedTo.push(assigneeId);
    await task.save();
    logger.info(`[POST /tasks/:taskId/users/:userId] Successfully assigned member ${req.params.userId} to task ${task._id}`);
    res.json(task);
  } catch (error) {
    logger.error(`[POST /tasks/:taskId/users/:userId] Error assigning user to task:`, error);
    res.status(500).json({ message: 'Error assigning user to task' });
  }
});

// Unassign member from task
router.delete('/:taskId/users/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[DELETE /tasks/:taskId/users/:userId] Unassigning member ${req.params.userId} from task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[DELETE /tasks/:taskId/users/:userId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      logger.warn(`[DELETE /tasks/:taskId/users/:userId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[DELETE /tasks/:taskId/users/:userId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[DELETE /tasks/:taskId/users/:userId] Access denied for user ${req.user!.userId} to unassign from task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const assigneeId = new mongoose.Types.ObjectId(req.params.userId);
    const assigneeIndex = task.assignedTo.findIndex(id => id.toString() === assigneeId.toString());

    if (assigneeIndex === -1) {
      logger.warn(`[DELETE /tasks/:taskId/users/:userId] Member ${req.params.userId} is not assigned to task ${task._id}`);
      return res.status(404).json({ message: 'Member is not assigned to this task' });
    }

    task.assignedTo.splice(assigneeIndex, 1);
    await task.save();
    logger.info(`[DELETE /tasks/:taskId/users/:userId] Successfully unassigned user ${req.params.userId} from task ${task._id}`);
    res.json(task);
  } catch (error) {
    logger.error(`[DELETE /tasks/:taskId/users/:userId] Error unassigning user from task:`, error);
    res.status(500).json({ message: 'Error unassigning user from task' });
  }
});

// Get specific task details
router.get('/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[GET /tasks/:taskId] Fetching task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[GET /tasks/:taskId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      logger.warn(`[GET /tasks/:taskId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[GET /tasks/:taskId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[GET /tasks/:taskId] Access denied for user ${req.user!.userId} to view task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    logger.info(`[GET /tasks/:taskId] Successfully fetched task ${task._id}`);
    res.json(task);
  } catch (error) {
    logger.error(`[GET /tasks/:taskId] Error fetching task details:`, error);
    res.status(500).json({ message: 'Error fetching task details' });
  }
});

// Update task
router.put('/:taskId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[PUT /tasks/:taskId] Updating task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[PUT /tasks/:taskId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      logger.warn(`[PUT /tasks/:taskId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[PUT /tasks/:taskId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[PUT /tasks/:taskId] Access denied for user ${req.user!.userId} to update task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Remove protected fields from the update
    const { assignedTo, position, listId, ...updateData } = req.body;
    if (assignedTo !== undefined) {
      logger.warn(`[PUT /tasks/:taskId] Ignored assignedTo field - use /users endpoint instead`);
    }
    if (position !== undefined) {
      logger.warn(`[PUT /tasks/:taskId] Ignored position field - use /position endpoint instead`);
    }
    if (listId !== undefined) {
      logger.warn(`[PUT /tasks/:taskId] Ignored listId field - use /lists endpoint instead`);
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.taskId,
      { $set: updateData },
      { new: true }
    );
    logger.info(`[PUT /tasks/:taskId] Successfully updated task ${updatedTask?._id}`);
    res.json(updatedTask);
  } catch (error) {
    logger.error(`[PUT /tasks/:taskId] Error updating task:`, error);
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
    logger.info(`[DELETE /tasks/:taskId] Deleting task ${req.params.taskId}`);
    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[DELETE /tasks/:taskId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    const list = await List.findById(task.listId) as IList;
    if (!list) {
      logger.warn(`[DELETE /tasks/:taskId] List ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(list.boardId) as IBoard;
    if (!board) {
      logger.warn(`[DELETE /tasks/:taskId] Board ${list.boardId} not found for list ${list._id}`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[DELETE /tasks/:taskId] Access denied for user ${req.user!.userId} to delete task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    await task.deleteOne();
    logger.info(`[DELETE /tasks/:taskId] Successfully deleted task ${task._id}`);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error(`[DELETE /tasks/:taskId] Error deleting task:`, error);
    res.status(500).json({ message: 'Error deleting task' });
  }
});

// Update task position
router.put('/:taskId/position', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { listId, position } = req.body;
    logger.info(`[PUT /tasks/:taskId/position] Updating position for task ${req.params.taskId} to position ${position}${listId ? ` in list ${listId}` : ''}`);

    if (typeof position !== 'number') {
      logger.warn(`[PUT /tasks/:taskId/position] Invalid position value provided: ${position}`);
      return res.status(400).json({ message: 'Invalid position value' });
    }

    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[PUT /tasks/:taskId/position] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get source and target lists
    const sourceList = await List.findById(task.listId) as IList;
    const targetList = listId ? await List.findById(listId) as IList : sourceList;
    
    if (!sourceList || (listId && !targetList)) {
      logger.warn(`[PUT /tasks/:taskId/position] List not found - Source: ${task.listId}, Target: ${listId}`);
      return res.status(404).json({ message: 'List not found' });
    }

    const board = await Board.findById(sourceList.boardId) as IBoard;
    if (!board || (targetList && targetList.boardId.toString() !== board._id!.toString())) {
      logger.warn(`[PUT /tasks/:taskId/position] Board ${sourceList.boardId} not found or lists belong to different boards`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[PUT /tasks/:taskId/position] Access denied for user ${req.user!.userId} to update task position`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update task's list if moving to a different list
    if (listId && listId !== task.listId.toString()) {
      logger.info(`[PUT /tasks/:taskId/position] Moving task from list ${task.listId} to list ${listId}`);
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

    logger.info(`[PUT /tasks/:taskId/position] Successfully updated position for task ${task._id} to ${position} in list ${targetList._id}`);
    res.json({ message: 'Task position updated successfully' });
  } catch (error) {
    logger.error(`[PUT /tasks/:taskId/position] Error updating task position:`, error);
    res.status(500).json({ message: 'Error updating task position' });
  }
});

router.put('/:taskId/lists/:listId', authMiddleware, async (req: Request, res: Response) => {
  try {
    logger.info(`[PUT /tasks/:taskId/lists/:listId] Moving task ${req.params.taskId} to list ${req.params.listId}`);

    const task = await Task.findById(req.params.taskId) as ITask;
    if (!task) {
      logger.warn(`[PUT /tasks/:taskId/lists/:listId] Task ${req.params.taskId} not found`);
      return res.status(404).json({ message: 'Task not found' });
    }

    // Get source list and board
    const sourceList = await List.findById(task.listId) as IList;
    if (!sourceList) {
      logger.warn(`[PUT /tasks/:taskId/lists/:listId] Source list ${task.listId} not found for task ${task._id}`);
      return res.status(404).json({ message: 'Source list not found' });
    }

    const sourceBoard = await Board.findById(sourceList.boardId) as IBoard;
    if (!sourceBoard) {
      logger.warn(`[PUT /tasks/:taskId/lists/:listId] Source board ${sourceList.boardId} not found for list ${sourceList._id}`);
      return res.status(404).json({ message: 'Source board not found' });
    }

    // Get target list
    const targetList = await List.findById(req.params.listId) as IList;
    if (!targetList) {
      logger.warn(`[PUT /tasks/:taskId/lists/:listId] Target list ${req.params.listId} not found`);
      return res.status(404).json({ message: 'Target list not found' });
    }

    // Verify both lists belong to the same board
    if (sourceList.boardId.toString() !== targetList.boardId.toString()) {
      logger.warn(`[PUT /tasks/:taskId/lists/:listId] Cannot move task between different boards`);
      return res.status(400).json({ message: 'Cannot move task between different boards' });
    }

    // Check if user has access to board
    if (!sourceBoard.members.includes(req.user!.userId) && sourceBoard.createdBy.toString() !== req.user!.userId.toString()) {
      logger.warn(`[PUT /tasks/:taskId/lists/:listId] Access denied for user ${req.user!.userId} to move task ${task._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // If already in the target list, return without changes
    if (task.listId.toString() === req.params.listId) {
      logger.info(`[PUT /tasks/:taskId/lists/:listId] Task ${task._id} is already in list ${req.params.listId}`);
      return res.json(task);
    }

    // Get the count of tasks in the target list to set position at the end
    const tasksInTargetList = await Task.countDocuments({ listId: targetList._id });

    // Update task's list and position
    task.listId = new mongoose.Types.ObjectId(req.params.listId);
    task.position = tasksInTargetList;
    await task.save();

    logger.info(`[PUT /tasks/:taskId/lists/:listId] Successfully moved task ${task._id} to list ${req.params.listId} at position ${tasksInTargetList}`);
    res.json(task);
  } catch (error) {
    logger.error(`[PUT /tasks/:taskId/lists/:listId] Error moving task to list:`, error);
    res.status(500).json({ message: 'Error moving task to list' });
  }
});

export default router;
