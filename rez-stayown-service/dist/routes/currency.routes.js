"use strict";
/**
 * Currency Routes for Multi-Currency Support
 *
 * Endpoints for:
 * - Get supported currencies
 * - Convert prices
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const currency_service_1 = require("../services/currency.service");
const router = (0, express_1.Router)();
/**
 * Get all supported currencies
 * GET /api/currency
 */
router.get('/', (_req, res) => {
    try {
        const currencies = currency_service_1.currencyService.getSupportedCurrencies();
        res.json({
            success: true,
            data: currencies,
        });
    }
    catch (error) {
        console.error('[Currency] Get currencies error:', error);
        res.status(500).json({ success: false, message: 'Failed to get currencies' });
    }
});
/**
 * Convert price from INR to target currency
 * GET /api/currency/convert?amount=5500&currency=USD
 */
router.get('/convert', (req, res) => {
    try {
        const { amount, currency } = req.query;
        if (!amount || !currency) {
            res.status(400).json({
                success: false,
                message: 'Missing required parameters: amount, currency',
            });
            return;
        }
        const amountPaise = parseInt(amount, 10);
        if (isNaN(amountPaise) || amountPaise < 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid amount. Must be a positive number.',
            });
            return;
        }
        const conversion = currency_service_1.currencyService.convertFromINR(amountPaise, currency);
        res.json({
            success: true,
            data: conversion,
        });
    }
    catch (error) {
        console.error('[Currency] Convert error:', error);
        res.status(500).json({ success: false, message: 'Currency conversion failed' });
    }
});
/**
 * Format price for display
 * GET /api/currency/format?amount=5500&currency=USD
 */
router.get('/format', (req, res) => {
    try {
        const { amount, currency } = req.query;
        if (!amount || !currency) {
            res.status(400).json({
                success: false,
                message: 'Missing required parameters: amount, currency',
            });
            return;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum < 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid amount. Must be a positive number.',
            });
            return;
        }
        const formatted = currency_service_1.currencyService.format(amountNum, currency);
        res.json({
            success: true,
            data: {
                original: { amount: amountNum, currency },
                formatted,
            },
        });
    }
    catch (error) {
        console.error('[Currency] Format error:', error);
        res.status(500).json({ success: false, message: 'Formatting failed' });
    }
});
exports.default = router;
//# sourceMappingURL=currency.routes.js.map