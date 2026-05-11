import Joi from 'joi';
import { ApplicationError } from './errorHandler.js';

/**
 * Shared input validation schemas and middleware for financial operations.
 * Ensures all financial POST routes have proper validation to prevent
 * injection attacks, data corruption, and abuse.
 */

// Reusable field validators
const mongoId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).message('Must be a valid ID');
const positiveAmount = Joi.number().positive().precision(2).max(999999999.99);
const currencyCode = Joi.string().length(3).uppercase().default('INR');
const dateField = Joi.date().iso();

// === Invoice Validation ===
export const invoiceCreationSchema = Joi.object({
  bookingId: mongoId.required(),
  type: Joi.string().valid('accommodation', 'service', 'additional', 'refund', 'cancellation').default('accommodation'),
  items: Joi.array().items(Joi.object({
    description: Joi.string().max(500).required(),
    category: Joi.string().max(100),
    quantity: Joi.number().min(0.01).required(),
    unitPrice: Joi.number().min(0).required(),
    amount: Joi.number().min(0)
  })).min(1).required(),
  dueDate: dateField.required(),
  notes: Joi.string().max(1000).allow(''),
  taxAmount: Joi.number().min(0),
  discountAmount: Joi.number().min(0),
  currency: currencyCode
}).options({ stripUnknown: true });

// === Billing Session Validation ===
export const billingSessionSchema = Joi.object({
  guestName: Joi.string().min(1).max(200).required(),
  roomNumber: Joi.string().min(1).max(20).required(),
  bookingId: mongoId,
  hotelId: mongoId.required(),
  notes: Joi.string().max(1000).allow('')
}).options({ stripUnknown: true });

// === Department Budget Validation ===
export const departmentBudgetSchema = Joi.object({
  department: Joi.string().valid(
    'housekeeping', 'maintenance', 'front_desk', 'food_beverage',
    'spa', 'laundry', 'kitchen', 'bar', 'other'
  ).required(),
  fiscalYear: Joi.number().integer().min(2020).max(2100).required(),
  month: Joi.number().integer().min(1).max(12),
  allocatedBudget: positiveAmount.required(),
  category: Joi.string().max(100),
  notes: Joi.string().max(1000).allow('')
}).options({ stripUnknown: true });

// === POS Order Validation ===
export const posOrderSchema = Joi.object({
  outletId: mongoId.required(),
  items: Joi.array().items(Joi.object({
    menuItemId: mongoId,
    name: Joi.string().max(200),
    quantity: Joi.number().integer().min(1).required(),
    price: Joi.number().min(0).required(),
    notes: Joi.string().max(500).allow('')
  })).min(1).required(),
  roomNumber: Joi.string().max(20),
  bookingId: mongoId,
  guestName: Joi.string().max(200),
  tableNumber: Joi.string().max(20),
  orderType: Joi.string().valid('dine_in', 'room_service', 'takeaway', 'delivery'),
  notes: Joi.string().max(1000).allow('')
}).options({ stripUnknown: true });

// === Revenue Pricing Rule Validation ===
export const pricingRuleSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('dynamic', 'seasonal', 'occupancy', 'demand', 'event', 'custom').required(),
  roomTypeId: mongoId,
  baseMultiplier: Joi.number().min(0.1).max(10).required(),
  conditions: Joi.object({
    minOccupancy: Joi.number().min(0).max(100),
    maxOccupancy: Joi.number().min(0).max(100),
    daysInAdvance: Joi.number().integer().min(0),
    dayOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)),
    season: Joi.string().valid('peak', 'high', 'shoulder', 'low', 'off_peak')
  }),
  validFrom: dateField,
  validTo: dateField,
  isActive: Joi.boolean().default(true),
  priority: Joi.number().integer().min(0).max(100)
}).options({ stripUnknown: true });

// === Generic Financial Amount Validation ===
export const financialAmountSchema = Joi.object({
  amount: positiveAmount.required(),
  currency: currencyCode,
  method: Joi.string().valid('cash', 'card', 'upi', 'bank_transfer', 'online_portal', 'refund_to_source'),
  reference: Joi.string().max(200).allow(''),
  notes: Joi.string().max(1000).allow('')
}).options({ stripUnknown: true });

/**
 * Generic validation middleware factory.
 * Usage: validateFinancial(invoiceCreationSchema)
 */
export function validateFinancial(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const messages = error.details.map(d => d.message).join('; ');
      return next(new ApplicationError(`Validation failed: ${messages}`, 400));
    }

    // Replace body with validated/sanitized value
    req.body = value;
    next();
  };
}

export default {
  invoiceCreationSchema,
  billingSessionSchema,
  departmentBudgetSchema,
  posOrderSchema,
  pricingRuleSchema,
  financialAmountSchema,
  validateFinancial
};
