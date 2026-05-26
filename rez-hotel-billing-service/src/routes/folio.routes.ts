/**
 * Folio Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as billingService from '../services/billingService';

const router = Router();

// Validation schemas
const createFolioSchema = z.object({
  hotelId: z.string().min(1),
  guestId: z.string().min(1),
  bookingId: z.string().min(1),
});

const addFolioItemSchema = z.object({
  type: z.enum(['room', 'food', 'bar', 'laundry', 'spa', 'parking', 'other']),
  description: z.string().min(1),
  amount: z.number().positive(),
  quantity: z.number().positive().optional().default(1),
  postedBy: z.string().optional(),
});

const addPaymentSchema = z.object({
  method: z.enum(['cash', 'card', 'upi', 'bank_transfer']),
  amount: z.number().positive(),
  reference: z.string().optional(),
  processedBy: z.string().optional(),
});

// Create folio
router.post('/', async (req: Request, res: Response) => {
  try {
    const params = createFolioSchema.parse(req.body);
    const folio = await billingService.createFolio(params);
    res.status(201).json({ success: true, data: folio });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    throw error;
  }
});

// Get folio by ID
router.get('/:folioId', async (req: Request, res: Response) => {
  try {
    const folio = await billingService.getFolio(req.params.folioId);
    if (!folio) {
      res.status(404).json({ success: false, error: 'Folio not found' });
      return;
    }
    res.json({ success: true, data: folio });
  } catch (error) {
    console.error('[FolioRoutes] Error fetching folio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch folio',
      code: 'FOLIO_FETCH_ERROR'
    });
  }
});

// Add item to folio
router.post('/:folioId/items', async (req: Request, res: Response) => {
  try {
    const { folioId, ...body } = { folioId: req.params.folioId, ...req.body };
    const params = addFolioItemSchema.parse(req.body);
    const folio = await billingService.addFolioItem({ folioId, ...params });
    if (!folio) {
      res.status(404).json({ success: false, error: 'Folio not found' });
      return;
    }
    res.json({ success: true, data: folio });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    throw error;
  }
});

// Add payment to folio
router.post('/:folioId/payments', async (req: Request, res: Response) => {
  try {
    const params = addPaymentSchema.parse(req.body);
    const folio = await billingService.addPayment({ folioId: req.params.folioId, ...params });
    if (!folio) {
      res.status(404).json({ success: false, error: 'Folio not found' });
      return;
    }
    res.json({ success: true, data: folio });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    throw error;
  }
});

// Close folio
router.post('/:folioId/close', async (req: Request, res: Response) => {
  try {
    const folio = await billingService.closeFolio(req.params.folioId);
    if (!folio) {
      res.status(404).json({ success: false, error: 'Folio not found' });
      return;
    }
    res.json({ success: true, data: folio });
  } catch (error) {
    console.error('[FolioRoutes] Error closing folio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close folio',
      code: 'FOLIO_CLOSE_ERROR'
    });
  }
});

// Get guest folios
router.get('/guest/:guestId', async (req: Request, res: Response) => {
  try {
    const folios = await billingService.getGuestFolios(req.params.guestId);
    res.json({ success: true, data: folios });
  } catch (error) {
    console.error('[FolioRoutes] Error fetching guest folios:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch guest folios',
      code: 'GUEST_FOLIOS_ERROR'
    });
  }
});

export default router;
