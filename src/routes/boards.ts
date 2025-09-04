import express, { Request, Response } from 'express';
import { Board } from '../models/Board';
import { List } from '../models/List';
import { Task } from '../models/Task';
import { authMiddleware } from '../middleware/auth';
import mongoose from 'mongoose';

const router = express.Router();

// Get all boards for authenticated user
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[GET /boards] Fetching boards for user ${req.user!.userId}`);
    const boards = await Board.find({
      $or: [
        { createdBy: req.user!.userId },
        { members: req.user!.userId }
      ]
    });
    console.log(`[GET /boards] Successfully fetched ${boards.length} boards`);
    res.json(boards);
  } catch (error) {
    console.error(`[GET /boards] Error fetching boards:`, error);
    res.status(500).json({ message: 'Error fetching boards' });
  }
});

// Create new board
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[POST /boards] Creating new board for user ${req.user!.userId}`);
    const board = new Board({
      ...req.body,
      createdBy: req.user!.userId,
      members: [req.user!.userId]
    });
    await board.save();
    console.log(`[POST /boards] Successfully created board with ID ${board._id}`);
    res.status(201).json(board);
  } catch (error) {
    console.error(`[POST /boards] Error creating board:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid board data' });
    } else {
      res.status(500).json({ message: 'Error creating board' });
    }
  }
});

// Get specific board with lists and tasks
router.get('/:boardId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[GET /boards/:boardId] Fetching board ${req.params.boardId} for user ${req.user!.userId}`);
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      console.log(`[GET /boards/:boardId] Board ${req.params.boardId} not found`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    if (!board.members.includes(req.user!.userId) && board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[GET /boards/:boardId] Access denied for user ${req.user!.userId} to board ${board._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const lists = await List.find({ boardId: board._id }).sort('position');
    const tasks = await Task.find({ listId: { $in: lists.map(list => list._id) } }).sort('position');

    console.log(`[GET /boards/:boardId] Successfully fetched board ${board._id} with ${lists.length} lists and ${tasks.length} tasks`);
    res.json({
      board,
      lists,
      tasks
    });
  } catch (error) {
    console.error(`[GET /boards/:boardId] Error fetching board details:`, error);
    res.status(500).json({ message: 'Error fetching board details' });
  }
});

// Update board details
router.put('/:boardId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[PUT /boards/:boardId] Updating board ${req.params.boardId} for user ${req.user!.userId}`);
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      console.log(`[PUT /boards/:boardId] Board ${req.params.boardId} not found`);
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[PUT /boards/:boardId] Access denied for user ${req.user!.userId} to update board ${board._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedBoard = await Board.findByIdAndUpdate(
      req.params.boardId,
      { $set: req.body },
      { new: true }
    );
    console.log(`[PUT /boards/:boardId] Successfully updated board ${updatedBoard?._id}`);
    res.json(updatedBoard);
  } catch (error) {
    console.error(`[PUT /boards/:boardId] Error updating board:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ message: 'Invalid board data' });
    } else {
      res.status(500).json({ message: 'Error updating board' });
    }
  }
});

// Delete board
router.delete('/:boardId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[DELETE /boards/:boardId] Deleting board ${req.params.boardId} by user ${req.user!.userId}`);
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      console.log(`[DELETE /boards/:boardId] Board ${req.params.boardId} not found`);
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[DELETE /boards/:boardId] Access denied for user ${req.user!.userId} to delete board ${board._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete all associated lists and tasks
    const lists = await List.find({ boardId: board._id });
    await Task.deleteMany({ listId: { $in: lists.map(list => list._id) } });
    await List.deleteMany({ boardId: board._id });
    await board.deleteOne();

    console.log(`[DELETE /boards/:boardId] Successfully deleted board ${board._id} with ${lists.length} lists`);
    res.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error(`[DELETE /boards/:boardId] Error deleting board:`, error);
    res.status(500).json({ message: 'Error deleting board' });
  }
});

// Add member to board
router.post('/:boardId/members', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[POST /boards/:boardId/members] Adding member to board ${req.params.boardId}`);
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      console.log(`[POST /boards/:boardId/members] Board ${req.params.boardId} not found`);
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[POST /boards/:boardId/members] Access denied for user ${req.user!.userId} to add members to board ${board._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const { userId } = req.body;
    const memberId = new mongoose.Types.ObjectId(userId);
    
    if (board.members.some(m => m.toString() === memberId.toString())) {
      console.log(`[POST /boards/:boardId/members] User ${userId} is already a member of board ${board._id}`);
      return res.status(400).json({ message: 'User is already a member' });
    }

    board.members.push(memberId);
    await board.save();
    console.log(`[POST /boards/:boardId/members] Successfully added member ${userId} to board ${board._id}`);
    res.json(board);
  } catch (error) {
    console.error(`[POST /boards/:boardId/members] Error adding member:`, error);
    res.status(400).json({ message: 'Error adding member' });
  }
});

// Remove member from board
router.delete('/:boardId/members/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[DELETE /boards/:boardId/members/:userId] Removing member ${req.params.userId} from board ${req.params.boardId}`);
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      console.log(`[DELETE /boards/:boardId/members/:userId] Board ${req.params.boardId} not found`);
      return res.status(404).json({ message: 'Board not found' });
    }

    if (board.createdBy.toString() !== req.user!.userId.toString()) {
      console.log(`[DELETE /boards/:boardId/members/:userId] Access denied for user ${req.user!.userId} to remove members from board ${board._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const memberId = new mongoose.Types.ObjectId(req.params.userId);
    const memberIndex = board.members.findIndex(m => m.toString() === memberId.toString());
    
    if (memberIndex === -1) {
      console.log(`[DELETE /boards/:boardId/members/:userId] Member ${req.params.userId} not found in board ${board._id}`);
      return res.status(404).json({ message: 'Member not found' });
    }

    board.members.splice(memberIndex, 1);
    await board.save();
    console.log(`[DELETE /boards/:boardId/members/:userId] Successfully removed member ${req.params.userId} from board ${board._id}`);
    res.json(board);
  } catch (error) {
    console.error(`[DELETE /boards/:boardId/members/:userId] Error removing member:`, error);
    res.status(400).json({ message: 'Error removing member' });
  }
});

// Create new list
router.post('/:boardId/lists', authMiddleware, async (req: Request, res: Response) => {
  try {
    console.log(`[POST /boards/:boardId/lists] Creating new list in board ${req.params.boardId}`);
    const board = await Board.findById(req.params.boardId);
    if (!board) {
      console.log(`[POST /boards/:boardId/lists] Board ${req.params.boardId} not found`);
      return res.status(404).json({ message: 'Board not found' });
    }

    // Check if user has access to board
    const userId = req.user?.userId;
    if (!userId || (!board.members.includes(userId) && board.createdBy.toString() !== userId.toString())) {
      console.log(`[POST /boards/:boardId/lists] Access denied for user ${userId} to create list in board ${board._id}`);
      return res.status(403).json({ message: 'Access denied' });
    }

    const lastList = await List.findOne({ boardId: board._id }).sort('-position');
    const position = lastList ? lastList.position + 1 : 0;

    const list = new List({
      ...req.body,
      boardId: board._id,
      position
    });

    await list.save();
    console.log(`[POST /boards/:boardId/lists] Successfully created list ${list._id} in board ${board._id}`);
    res.status(201).json(list);
  } catch (error) {
    console.error(`[POST /boards/:boardId/lists] Error creating list:`, error);
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(400).json({ message: 'Invalid list data' });
    } else {
        res.status(500).json({ message: 'Error creating list' });
    }
  }
});

export default router;
