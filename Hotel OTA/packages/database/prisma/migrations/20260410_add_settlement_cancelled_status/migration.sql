-- Add 'cancelled' value to SettlementStatus enum
-- Used by SettlementService.reverseEntry() to mark entries for cancelled bookings

ALTER TYPE "SettlementStatus" ADD VALUE IF NOT EXISTS 'cancelled';
