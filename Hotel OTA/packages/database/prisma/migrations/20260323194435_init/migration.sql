-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('basic', 'silver', 'gold');

-- CreateEnum
CREATE TYPE "AttributionSource" AS ENUM ('ota_app', 'rez_app', 'corporate', 'hotel_qr', 'seo', 'direct');

-- CreateEnum
CREATE TYPE "HotelCategory" AS ENUM ('budget', 'midscale', 'upscale', 'boutique', 'serviced_apartment');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('pending', 'active', 'suspended', 'churned');

-- CreateEnum
CREATE TYPE "ChannelSource" AS ENUM ('ota_app', 'rez_app', 'corporate', 'hotel_qr');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('init', 'hold', 'confirmed', 'checked_in', 'stayed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'refunded', 'partial_refund');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('upi', 'card', 'netbanking', 'ota_wallet', 'rez_wallet', 'corporate_credit');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('not_applicable', 'pending', 'processed');

-- CreateEnum
CREATE TYPE "BookingEventType" AS ENUM ('created', 'hold_placed', 'confirmed', 'payment_received', 'checked_in', 'stayed', 'cancelled', 'refunded', 'coin_earned', 'coin_burned', 'mining_triggered', 'settlement_triggered');

-- CreateEnum
CREATE TYPE "EventTriggeredBy" AS ENUM ('user', 'system', 'admin', 'rez_webhook');

-- CreateEnum
CREATE TYPE "CoinType" AS ENUM ('ota', 'rez');

-- CreateEnum
CREATE TYPE "CoinTransactionType" AS ENUM ('earn', 'burn', 'expire', 'refund_credit', 'admin_adjust');

-- CreateEnum
CREATE TYPE "CoinDirection" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "EarnRuleChannel" AS ENUM ('ota_app', 'rez_app', 'corporate', 'hotel_qr', 'all');

-- CreateEnum
CREATE TYPE "EarnRuleTier" AS ENUM ('basic', 'silver', 'gold', 'all');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'approved', 'paid', 'disputed');

-- CreateEnum
CREATE TYPE "PayoutBatchStatus" AS ENUM ('processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "CoinExpiryStatus" AS ENUM ('pending', 'expired', 'used');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(15) NOT NULL,
    "email" VARCHAR(255),
    "full_name" VARCHAR(255),
    "profile_photo_url" TEXT,
    "tier" "UserTier" NOT NULL DEFAULT 'basic',
    "rez_user_id" VARCHAR(255),
    "attribution_source" "AttributionSource" NOT NULL DEFAULT 'ota_app',
    "attribution_partner" VARCHAR(50),
    "attribution_expiry_ts" TIMESTAMPTZ,
    "last_campaign_click_ts" TIMESTAMPTZ,
    "last_campaign_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "legal_name" VARCHAR(255),
    "gstin" VARCHAR(15),
    "pan" VARCHAR(10),
    "address_line1" VARCHAR(255),
    "address_line2" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL DEFAULT 'Bangalore',
    "pincode" VARCHAR(10),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "star_rating" SMALLINT,
    "category" "HotelCategory",
    "description" TEXT,
    "amenities" JSONB,
    "images" JSONB,
    "primary_contact_name" VARCHAR(255),
    "primary_contact_phone" VARCHAR(15),
    "primary_contact_email" VARCHAR(255),
    "bank_account_number" VARCHAR(50),
    "bank_ifsc" VARCHAR(11),
    "bank_account_name" VARCHAR(255),
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'pending',
    "participation_agreement_signed" BOOLEAN NOT NULL DEFAULT false,
    "participation_agreement_date" DATE,
    "ota_commission_pct" DECIMAL(4,2) NOT NULL DEFAULT 6.00,
    "mining_eligible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "max_occupancy" SMALLINT NOT NULL DEFAULT 2,
    "bed_type" VARCHAR(100),
    "size_sqft" SMALLINT,
    "amenities" JSONB,
    "images" JSONB,
    "base_rate_paise" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_slots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_rooms" SMALLINT NOT NULL,
    "available_rooms" SMALLINT NOT NULL,
    "rate_paise" INTEGER NOT NULL,
    "min_stay_nights" SMALLINT NOT NULL DEFAULT 1,
    "is_blocked" BOOLEAN NOT NULL DEFAULT false,
    "block_reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inventory_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_ref" VARCHAR(20) NOT NULL,
    "user_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "channel_source" "ChannelSource" NOT NULL,
    "attribution_partner" VARCHAR(50),
    "campaign_id" VARCHAR(100),
    "checkin_date" DATE NOT NULL,
    "checkout_date" DATE NOT NULL,
    "num_nights" SMALLINT NOT NULL,
    "num_rooms" SMALLINT NOT NULL DEFAULT 1,
    "num_guests" SMALLINT NOT NULL DEFAULT 1,
    "guest_name" VARCHAR(255),
    "guest_phone" VARCHAR(15),
    "special_requests" TEXT,
    "room_rate_paise" INTEGER NOT NULL,
    "total_value_paise" INTEGER NOT NULL,
    "ota_commission_paise" INTEGER NOT NULL,
    "ota_coin_burned_paise" INTEGER NOT NULL DEFAULT 0,
    "rez_coin_burned_paise" INTEGER NOT NULL DEFAULT 0,
    "pg_amount_paise" INTEGER NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_method" "PaymentMethod",
    "razorpay_order_id" VARCHAR(255),
    "razorpay_payment_id" VARCHAR(255),
    "status" "BookingStatus" NOT NULL DEFAULT 'init',
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ,
    "refund_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "refund_status" "RefundStatus" NOT NULL DEFAULT 'not_applicable',
    "stay_completed_flag" BOOLEAN NOT NULL DEFAULT false,
    "stay_completed_at" TIMESTAMPTZ,
    "hold_expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "event_type" "BookingEventType" NOT NULL,
    "event_data" JSONB,
    "triggered_by" "EventTriggeredBy" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "ota_coin_balance_paise" INTEGER NOT NULL DEFAULT 0,
    "ota_coin_lifetime_earned_paise" INTEGER NOT NULL DEFAULT 0,
    "ota_coin_lifetime_burned_paise" INTEGER NOT NULL DEFAULT 0,
    "rez_coin_balance_paise" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "coin_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "coin_type" "CoinType" NOT NULL,
    "transaction_type" "CoinTransactionType" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "direction" "CoinDirection" NOT NULL,
    "booking_id" UUID,
    "earn_rule_id" UUID,
    "expiry_date" DATE,
    "balance_after_paise" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "earn_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_name" VARCHAR(255) NOT NULL,
    "coin_type" "CoinType" NOT NULL,
    "channel_source" "EarnRuleChannel" NOT NULL DEFAULT 'all',
    "hotel_id" UUID,
    "user_tier" "EarnRuleTier" NOT NULL DEFAULT 'all',
    "campaign_id" VARCHAR(100),
    "earn_pct" DECIMAL(5,2) NOT NULL,
    "min_booking_value_paise" INTEGER NOT NULL DEFAULT 0,
    "max_earn_per_booking_paise" INTEGER,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "earn_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "burn_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "coin_type" "CoinType" NOT NULL,
    "user_tier" "EarnRuleTier" NOT NULL DEFAULT 'all',
    "hotel_id" UUID,
    "max_burn_pct" DECIMAL(5,2) NOT NULL,
    "min_cash_pct" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "burn_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_expiry_schedule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "coin_type" "CoinType" NOT NULL,
    "amount_paise" INTEGER NOT NULL,
    "expiry_date" DATE NOT NULL,
    "source_transaction_id" UUID NOT NULL,
    "status" "CoinExpiryStatus" NOT NULL DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "coin_expiry_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "available_balance_paise" INTEGER NOT NULL DEFAULT 0,
    "pending_balance_paise" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned_paise" INTEGER NOT NULL DEFAULT 0,
    "lifetime_settled_paise" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "gross_amount_paise" INTEGER NOT NULL,
    "commission_paise" INTEGER NOT NULL,
    "coin_liability_paise" INTEGER NOT NULL DEFAULT 0,
    "net_payable_paise" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "payout_batch_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "settlement_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_ref" VARCHAR(50) NOT NULL,
    "total_hotels" INTEGER NOT NULL,
    "total_amount_paise" INTEGER NOT NULL,
    "status" "PayoutBatchStatus" NOT NULL DEFAULT 'processing',
    "razorpay_payout_id" VARCHAR(255),
    "initiated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "payout_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(15) NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "otp_ref" VARCHAR(50) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "phone" VARCHAR(15) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'manager',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "inventory_slots_hotel_id_date_idx" ON "inventory_slots"("hotel_id", "date");

-- CreateIndex
CREATE INDEX "inventory_slots_room_type_id_date_available_rooms_idx" ON "inventory_slots"("room_type_id", "date", "available_rooms");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_slots_room_type_id_date_key" ON "inventory_slots"("room_type_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_booking_ref_key" ON "bookings"("booking_ref");

-- CreateIndex
CREATE INDEX "bookings_user_id_created_at_idx" ON "bookings"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bookings_hotel_id_checkin_date_idx" ON "bookings"("hotel_id", "checkin_date");

-- CreateIndex
CREATE INDEX "bookings_status_checkin_date_idx" ON "bookings"("status", "checkin_date");

-- CreateIndex
CREATE INDEX "bookings_channel_source_attribution_partner_idx" ON "bookings"("channel_source", "attribution_partner");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_created_at_idx" ON "booking_events"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "coin_wallets_user_id_key" ON "coin_wallets"("user_id");

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_coin_type_created_at_idx" ON "coin_transactions"("user_id", "coin_type", "created_at");

-- CreateIndex
CREATE INDEX "coin_transactions_expiry_date_idx" ON "coin_transactions"("expiry_date");

-- CreateIndex
CREATE INDEX "coin_expiry_schedule_expiry_date_status_idx" ON "coin_expiry_schedule"("expiry_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_wallets_hotel_id_key" ON "hotel_wallets"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlement_entries_booking_id_key" ON "settlement_entries"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_batches_batch_ref_key" ON "payout_batches"("batch_ref");

-- CreateIndex
CREATE UNIQUE INDEX "otp_records_otp_ref_key" ON "otp_records"("otp_ref");

-- CreateIndex
CREATE INDEX "otp_records_phone_created_at_idx" ON "otp_records"("phone", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_staff_hotel_id_phone_key" ON "hotel_staff"("hotel_id", "phone");

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_slots" ADD CONSTRAINT "inventory_slots_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_slots" ADD CONSTRAINT "inventory_slots_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_wallets" ADD CONSTRAINT "coin_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "coin_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_earn_rule_id_fkey" FOREIGN KEY ("earn_rule_id") REFERENCES "earn_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "earn_rules" ADD CONSTRAINT "earn_rules_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_expiry_schedule" ADD CONSTRAINT "coin_expiry_schedule_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_expiry_schedule" ADD CONSTRAINT "coin_expiry_schedule_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "coin_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_wallets" ADD CONSTRAINT "hotel_wallets_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_entries" ADD CONSTRAINT "settlement_entries_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_entries" ADD CONSTRAINT "settlement_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_entries" ADD CONSTRAINT "settlement_entries_payout_batch_id_fkey" FOREIGN KEY ("payout_batch_id") REFERENCES "payout_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
