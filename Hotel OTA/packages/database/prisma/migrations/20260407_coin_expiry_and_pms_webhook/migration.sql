-- Migration: Add coin_expiry fields and PMS webhook URL support (Hotel OTA)
-- Fixed: correct lowercase table names + UUID foreign keys matching hotels/users/coin_wallets

-- Add hotel coin tracking columns to coin_wallets
ALTER TABLE "coin_wallets" ADD COLUMN IF NOT EXISTS "hotel_coins_earned" INTEGER DEFAULT 0;
ALTER TABLE "coin_wallets" ADD COLUMN IF NOT EXISTS "hotel_coins_spent" INTEGER DEFAULT 0;
ALTER TABLE "coin_wallets" ADD COLUMN IF NOT EXISTS "coin_expiry" TIMESTAMP;
ALTER TABLE "coin_wallets" ADD COLUMN IF NOT EXISTS "expiring_coins" INTEGER DEFAULT 0;

-- Add hotel_id external reference and PMS webhook support to hotels
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "hotel_id" TEXT UNIQUE;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "pms_webhook_url" TEXT;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "pms_webhook_secret" TEXT;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "pms_webhook_active" BOOLEAN DEFAULT FALSE;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "pms_webhook_last_triggered_at" TIMESTAMP;
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "pms_webhook_error_count" INTEGER DEFAULT 0;

-- Coin expiration policy table
CREATE TABLE IF NOT EXISTS "coin_expiration_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "name" TEXT NOT NULL,
  "expiration_days" INTEGER NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PMS webhook event log
CREATE TABLE IF NOT EXISTS "pms_webhook_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "hotel_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_data" JSONB NOT NULL,
  "processed" BOOLEAN NOT NULL DEFAULT FALSE,
  "processed_at" TIMESTAMP,
  "error" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pms_webhook_events_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "pms_webhook_events_hotel_id_event_type_idx" ON "pms_webhook_events"("hotel_id", "event_type");
CREATE INDEX IF NOT EXISTS "pms_webhook_events_processed_idx" ON "pms_webhook_events"("processed");

-- Hotel booking coin transaction log
CREATE TABLE IF NOT EXISTS "hotel_booking_coin_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "hotel_id" UUID NOT NULL,
  "booking_id" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "coin_amount" INTEGER NOT NULL,
  "booking_amount" DECIMAL(10, 2) NOT NULL,
  "coin_rate" DECIMAL(5, 2) NOT NULL DEFAULT 0.01,
  "transaction_type" TEXT NOT NULL DEFAULT 'booking',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "notes" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_booking_coin_txn_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels" ("id") ON DELETE CASCADE,
  CONSTRAINT "hotel_booking_coin_txn_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "hotel_booking_coin_txn_hotel_booking_idx" ON "hotel_booking_coin_transactions"("hotel_id", "booking_id");
CREATE INDEX IF NOT EXISTS "hotel_booking_coin_txn_user_idx" ON "hotel_booking_coin_transactions"("user_id");
CREATE INDEX IF NOT EXISTS "hotel_booking_coin_txn_status_idx" ON "hotel_booking_coin_transactions"("status");

-- Hotel coin expiration notification tracking
CREATE TABLE IF NOT EXISTS "hotel_coin_expiry_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "wallet_id" UUID NOT NULL,
  "days_until_expiry" INTEGER NOT NULL,
  "notification_sent" BOOLEAN DEFAULT FALSE,
  "sent_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_coin_expiry_notif_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "coin_wallets" ("id") ON DELETE CASCADE
);
