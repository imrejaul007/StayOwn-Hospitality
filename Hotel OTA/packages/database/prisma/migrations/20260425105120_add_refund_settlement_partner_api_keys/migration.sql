/*
  Warnings:

  - The `hotel_id` column on the `hotels` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `pms_webhook_url` on the `hotels` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(500)`.
  - You are about to alter the column `pms_webhook_secret` on the `hotels` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.
  - Made the column `hotel_coins_earned` on table `coin_wallets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `hotel_coins_spent` on table `coin_wallets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `expiring_coins` on table `coin_wallets` required. This step will fail if there are existing NULL values in that column.
  - Made the column `notification_sent` on table `hotel_coin_expiry_notifications` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pms_webhook_active` on table `hotels` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pms_webhook_error_count` on table `hotels` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "hotel_booking_coin_transactions" DROP CONSTRAINT "hotel_booking_coin_txn_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "hotel_booking_coin_transactions" DROP CONSTRAINT "hotel_booking_coin_txn_user_id_fkey";

-- DropForeignKey
ALTER TABLE "hotel_coin_expiry_notifications" DROP CONSTRAINT "hotel_coin_expiry_notif_wallet_id_fkey";

-- DropForeignKey
ALTER TABLE "pms_webhook_events" DROP CONSTRAINT "pms_webhook_events_hotel_id_fkey";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancellation_penalty_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mining_eligibility_snapshot_at" TIMESTAMPTZ,
ADD COLUMN     "mining_eligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mining_rules_version" VARCHAR(20) NOT NULL DEFAULT 'v1';

-- AlterTable
ALTER TABLE "coin_expiration_policies" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updated_at" DROP DEFAULT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "coin_expiry_schedule" ADD COLUMN     "hotel_id" UUID;

-- AlterTable
ALTER TABLE "coin_transactions" ADD COLUMN     "idempotency_key" VARCHAR(255);

-- AlterTable
ALTER TABLE "coin_wallets" ALTER COLUMN "hotel_coins_earned" SET NOT NULL,
ALTER COLUMN "hotel_coins_spent" SET NOT NULL,
ALTER COLUMN "coin_expiry" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "expiring_coins" SET NOT NULL;

-- AlterTable
ALTER TABLE "hotel_booking_coin_transactions" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "hotel_coin_expiry_notifications" ALTER COLUMN "notification_sent" SET NOT NULL,
ALTER COLUMN "sent_at" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "hotels" DROP COLUMN "hotel_id",
ADD COLUMN     "hotel_id" UUID,
ALTER COLUMN "pms_webhook_url" SET DATA TYPE VARCHAR(500),
ALTER COLUMN "pms_webhook_secret" SET DATA TYPE VARCHAR(255),
ALTER COLUMN "pms_webhook_active" SET NOT NULL,
ALTER COLUMN "pms_webhook_last_triggered_at" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "pms_webhook_error_count" SET NOT NULL;

-- AlterTable
ALTER TABLE "pms_webhook_events" ALTER COLUMN "processed_at" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "partner_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" VARCHAR(100) NOT NULL,
    "partner_name" VARCHAR(255) NOT NULL,
    "api_key_hash" VARCHAR(64) NOT NULL,
    "api_key_prefix" VARCHAR(8) NOT NULL,
    "scopes" VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    "label" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "partner_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "razorpay_refund_id" VARCHAR(255),
    "failure_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "settlement_id" UUID,
    "action" VARCHAR(50) NOT NULL,
    "booking_id" UUID,
    "hotel_id" UUID,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_api_keys_partner_id_idx" ON "partner_api_keys"("partner_id");

-- CreateIndex
CREATE INDEX "partner_api_keys_api_key_prefix_idx" ON "partner_api_keys"("api_key_prefix");

-- CreateIndex
CREATE INDEX "refunds_booking_id_idx" ON "refunds"("booking_id");

-- CreateIndex
CREATE INDEX "refunds_razorpay_refund_id_idx" ON "refunds"("razorpay_refund_id");

-- CreateIndex
CREATE INDEX "refunds_status_created_at_idx" ON "refunds"("status", "created_at");

-- CreateIndex
CREATE INDEX "settlement_audit_logs_settlement_id_idx" ON "settlement_audit_logs"("settlement_id");

-- CreateIndex
CREATE INDEX "settlement_audit_logs_booking_id_idx" ON "settlement_audit_logs"("booking_id");

-- CreateIndex
CREATE INDEX "settlement_audit_logs_action_created_at_idx" ON "settlement_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "coin_transactions_idempotency_key_idx" ON "coin_transactions"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_hotel_id_key" ON "hotels"("hotel_id");

-- AddForeignKey
ALTER TABLE "coin_expiry_schedule" ADD CONSTRAINT "coin_expiry_schedule_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pms_webhook_events" ADD CONSTRAINT "pms_webhook_events_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_booking_coin_transactions" ADD CONSTRAINT "hotel_booking_coin_transactions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_booking_coin_transactions" ADD CONSTRAINT "hotel_booking_coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_coin_expiry_notifications" ADD CONSTRAINT "hotel_coin_expiry_notifications_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "coin_wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "hotel_booking_coin_txn_hotel_booking_idx" RENAME TO "hotel_booking_coin_transactions_hotel_id_booking_id_idx";

-- RenameIndex
ALTER INDEX "hotel_booking_coin_txn_status_idx" RENAME TO "hotel_booking_coin_transactions_status_idx";

-- RenameIndex
ALTER INDEX "hotel_booking_coin_txn_user_idx" RENAME TO "hotel_booking_coin_transactions_user_id_idx";
