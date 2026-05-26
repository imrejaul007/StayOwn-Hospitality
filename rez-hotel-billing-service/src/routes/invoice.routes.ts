/**
 * Invoice Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as billingService from '../services/billingService';

const router = Router();

// Validation schemas
const createInvoiceSchema = z.object({
  hotelId: z.string().min(1),
  guestId: z.string().min(1),
  folioId: z.string().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestAddress: z.string().optional(),
});

const markPaidSchema = z.object({
  paymentMethod: z.string().min(1),
  paymentReference: z.string().optional(),
});

// Create invoice from folio
router.post('/', async (req: Request, res: Response) => {
  try {
    const params = createInvoiceSchema.parse(req.body);
    const invoice = await billingService.createInvoice(params);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    if (error instanceof Error && error.message === 'Folio not found') {
      res.status(404).json({ success: false, error: 'Folio not found' });
      return;
    }
    throw error;
  }
});

// Get invoice by ID
router.get('/:invoiceId', async (req: Request, res: Response) => {
  try {
    const invoice = await billingService.getInvoice(req.params.invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[InvoiceRoutes] Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice',
      code: 'INVOICE_FETCH_ERROR'
    });
  }
});

// Issue invoice (change status from draft to issued)
router.post('/:invoiceId/issue', async (req: Request, res: Response) => {
  try {
    const invoice = await billingService.issueInvoice(req.params.invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[InvoiceRoutes] Error issuing invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to issue invoice',
      code: 'INVOICE_ISSUE_ERROR'
    });
  }
});

// Mark invoice as paid
router.post('/:invoiceId/pay', async (req: Request, res: Response) => {
  try {
    const params = markPaidSchema.parse(req.body);
    const invoice = await billingService.markInvoicePaid({
      invoiceId: req.params.invoiceId,
      ...params,
    });
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: error.errors });
      return;
    }
    throw error;
  }
});

// Get guest invoices
router.get('/guest/:guestId', async (req: Request, res: Response) => {
  try {
    const invoices = await billingService.getGuestInvoices(req.params.guestId);
    res.json({ success: true, data: invoices });
  } catch (error) {
    console.error('[InvoiceRoutes] Error fetching guest invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch guest invoices',
      code: 'GUEST_INVOICES_ERROR'
    });
  }
});

export default router;
