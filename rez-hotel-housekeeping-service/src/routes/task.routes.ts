/**
 * Task Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  createTask,
  getTasks,
  getTask,
  assignTask,
  startTask,
  completeTask,
  verifyTask,
} from '../services/housekeepingService';

const router = Router();

// Get all tasks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hotelId, status, assignedTo, priority, taskType } = req.query;
    const tasks = await getTasks(hotelId as string, {
      status,
      assignedTo: assignedTo as string,
      priority: priority as any,
      taskType: taskType as any,
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
});

// Create task
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await createTask(req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Get single task
router.get('/:taskId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await getTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Assign task
router.post('/:taskId/assign', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { staffId, staffName } = req.body;
    const task = await assignTask({ taskId: req.params.taskId, staffId, staffName });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Start task
router.post('/:taskId/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await startTask(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Complete task
router.post('/:taskId/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { checklist } = req.body;
    const task = await completeTask(req.params.taskId, checklist);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

// Verify task
router.post('/:taskId/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supervisorId } = req.body;
    const task = await verifyTask(req.params.taskId, supervisorId);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
});

export { router as taskRoutes };
