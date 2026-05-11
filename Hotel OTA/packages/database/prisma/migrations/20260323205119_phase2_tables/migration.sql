-- CreateEnum
CREATE TYPE "VestingStatus" AS ENUM ('locked', 'vested', 'converted', 'forfeited');

-- CreateEnum
CREATE TYPE "VestingScheduleStatus" AS ENUM ('pending', 'unlocked', 'forfeited');

-- CreateEnum
CREATE TYPE "AttributionType" AS ENUM ('first_touch', 'campaign_override', 'none');

-- CreateEnum
CREATE TYPE "CorporateRole" AS ENUM ('admin', 'traveller', 'approver');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "corporate_account_id" UUID;

-- CreateTable
CREATE TABLE "hotel_contribution_scores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "period_month" DATE NOT NULL,
    "rooms_allocated" SMALLINT NOT NULL,
    "availability_pct" DECIMAL(5,2) NOT NULL,
    "adr_paise" INTEGER NOT NULL,
    "room_nights_booked" INTEGER NOT NULL,
    "repeat_booking_count" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2),
    "cancellation_rate_pct" DECIMAL(5,2),
    "raw_score" DECIMAL(10,4) NOT NULL,
    "normalized_score" DECIMAL(10,8) NOT NULL,
    "network_total_score" DECIMAL(10,4) NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_contribution_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_pool_schedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "year_number" SMALLINT NOT NULL,
    "pool_pct" DECIMAL(5,2) NOT NULL,
    "total_units_available" INTEGER NOT NULL,
    "notes" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ownership_pool_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_token_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "period_month" DATE NOT NULL,
    "units_issued" DECIMAL(12,6) NOT NULL,
    "normalized_score_used" DECIMAL(10,8) NOT NULL,
    "pool_units_this_month" INTEGER NOT NULL,
    "vesting_start_date" DATE NOT NULL,
    "vesting_end_date" DATE NOT NULL,
    "vesting_status" "VestingStatus" NOT NULL DEFAULT 'locked',
    "conversion_equity_pct" DECIMAL(12,8),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_token_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vesting_schedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ledger_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "unlock_date" DATE NOT NULL,
    "units_to_unlock" DECIMAL(12,6) NOT NULL,
    "status" "VestingScheduleStatus" NOT NULL DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "vesting_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribution_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "partner" VARCHAR(50),
    "attribution_type" "AttributionType" NOT NULL,
    "campaign_id" VARCHAR(100),
    "demand_fee_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "demand_fee_paise" INTEGER NOT NULL DEFAULT 0,
    "attribution_window_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attribution_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rez_booking_sync" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "rez_session_id" VARCHAR(255),
    "rez_user_id" VARCHAR(255),
    "rez_campaign_id" VARCHAR(255),
    "deep_link_ref" VARCHAR(255),
    "webhook_sent" BOOLEAN NOT NULL DEFAULT false,
    "webhook_sent_at" TIMESTAMPTZ,
    "webhook_response_code" SMALLINT,
    "rez_coin_triggered" BOOLEAN NOT NULL DEFAULT false,
    "rez_coin_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rez_booking_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "payment_ref" VARCHAR(255) NOT NULL,
    "razorpay_payment_id" VARCHAR(255),
    "linked_booking_id" UUID,
    "stay_registration_id" UUID,
    "ota_coin_earned_paise" INTEGER NOT NULL DEFAULT 0,
    "rez_coin_earned_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "company_name" VARCHAR(255) NOT NULL,
    "gstin" VARCHAR(15),
    "billing_email" VARCHAR(255),
    "billing_address" TEXT,
    "credit_limit_paise" INTEGER NOT NULL DEFAULT 0,
    "used_credit_paise" INTEGER NOT NULL DEFAULT 0,
    "payment_terms_days" SMALLINT NOT NULL DEFAULT 30,
    "account_manager_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "corporate_account_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "CorporateRole" NOT NULL DEFAULT 'traveller',
    "cost_center" VARCHAR(100),
    "travel_policy_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "corporate_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "api_key" VARCHAR(255) NOT NULL,
    "label" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "hotel_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_id" UUID NOT NULL,
    "referred_user_id" UUID,
    "referral_code" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "referrer_reward_paise" INTEGER NOT NULL DEFAULT 0,
    "referred_reward_paise" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_contribution_scores_hotel_id_period_month_key" ON "hotel_contribution_scores"("hotel_id", "period_month");

-- CreateIndex
CREATE INDEX "ownership_token_ledger_hotel_id_period_month_idx" ON "ownership_token_ledger"("hotel_id", "period_month");

-- CreateIndex
CREATE INDEX "ownership_token_ledger_vesting_end_date_vesting_status_idx" ON "ownership_token_ledger"("vesting_end_date", "vesting_status");

-- CreateIndex
CREATE INDEX "vesting_schedule_unlock_date_status_idx" ON "vesting_schedule"("unlock_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "offline_payments_payment_ref_key" ON "offline_payments"("payment_ref");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_api_keys_api_key_key" ON "hotel_api_keys"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referral_code_key" ON "referrals"("referral_code");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_contribution_scores" ADD CONSTRAINT "hotel_contribution_scores_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_token_ledger" ADD CONSTRAINT "ownership_token_ledger_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vesting_schedule" ADD CONSTRAINT "vesting_schedule_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "ownership_token_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vesting_schedule" ADD CONSTRAINT "vesting_schedule_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_log" ADD CONSTRAINT "attribution_log_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_log" ADD CONSTRAINT "attribution_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rez_booking_sync" ADD CONSTRAINT "rez_booking_sync_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_payments" ADD CONSTRAINT "offline_payments_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_payments" ADD CONSTRAINT "offline_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_users" ADD CONSTRAINT "corporate_users_corporate_account_id_fkey" FOREIGN KEY ("corporate_account_id") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_users" ADD CONSTRAINT "corporate_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_api_keys" ADD CONSTRAINT "hotel_api_keys_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
