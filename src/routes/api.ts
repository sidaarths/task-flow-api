import express from 'express';
import boardsRouter from './boards';
import listsRouter from './lists';
import tasksRouter from './tasks';
import authRouter from './auth';
import usersRouter from './users';
import pusherRouter from './pusher';

const router = express.Router();

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/boards', boardsRouter);
router.use('/lists', listsRouter);
router.use('/tasks', tasksRouter);
router.use('/pusher', pusherRouter);

export default router;
