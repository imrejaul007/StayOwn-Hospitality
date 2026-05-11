/**
 * Currency Routes for Multi-Currency Support
 *
 * Endpoints for:
 * - Get supported currencies
 * - Convert prices
 */

import { Router, Request, Response } from 'express';
import { currencyService } from '../services/currency.service';

const router = Router();

/**
 * Get all supported currencies
 * GET /api/currency
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const currencies = currencyService.getSupportedCurrencies();

    res.json({
      success: true,
      data: currencies,
    });
  } catch (error) {
    console.error('[Currency] Get currencies error:', error);
    res.status(500).json({ success: false, message: 'Failed to get currencies' });
  }
});

/**
 * Convert price from INR to target currency
 * GET /api/currency/convert?amount=5500&currency=USD
 */
router.get('/convert', (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.query;

    if (!amount || !currency) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: amount, currency',
      });
      return;
    }

    const amountPaise = parseInt(amount as string, 10);
    if (isNaN(amountPaise) || amountPaise < 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number.',
      });
      return;
    }

    const conversion = currencyService.convertFromINR(amountPaise, currency as string);

    res.json({
      success: true,
      data: conversion,
    });
  } catch (error) {
    console.error('[Currency] Convert error:', error);
    res.status(500).json({ success: false, message: 'Currency conversion failed' });
  }
});

/**
 * Format price for display
 * GET /api/currency/format?amount=5500&currency=USD
 */
router.get('/format', (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.query;

    if (!amount || !currency) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: amount, currency',
      });
      return;
    }

    const amountNum = parseFloat(amount as string);
    if (isNaN(amountNum) || amountNum < 0) {
      res.status(400).json({
        success: false,
        message: 'Invalid amount. Must be a positive number.',
      });
      return;
    }

    const formatted = currencyService.format(amountNum, currency as string);

    res.json({
      success: true,
      data: {
        original: { amount: amountNum, currency },
        formatted,
      },
    });
  } catch (error) {
    console.error('[Currency] Format error:', error);
    res.status(500).json({ success: false, message: 'Formatting failed' });
  }
});

export default router;
