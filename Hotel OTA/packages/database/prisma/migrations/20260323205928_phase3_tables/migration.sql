-- CreateEnum
CREATE TYPE "ChannelManagerProvider" AS ENUM ('siteminder', 'staah', 'rategain', 'custom');

-- CreateTable
CREATE TABLE "channel_manager_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "provider" "ChannelManagerProvider" NOT NULL,
    "api_key" VARCHAR(255),
    "api_secret" VARCHAR(255),
    "property_id" VARCHAR(255),
    "sync_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ,
    "sync_status" VARCHAR(20) NOT NULL DEFAULT 'idle',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "channel_manager_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_manager_sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "config_id" UUID NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(20) NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_manager_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_landing_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(255) NOT NULL,
    "hotel_id" UUID,
    "city" VARCHAR(100),
    "category" VARCHAR(50),
    "title" VARCHAR(255) NOT NULL,
    "meta_desc" VARCHAR(500),
    "h1" VARCHAR(255),
    "body_html" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "seo_landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_partners" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "commission_pct" DECIMAL(5,2) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "contact_email" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "total_click_count" INTEGER NOT NULL DEFAULT 0,
    "total_bookings" INTEGER NOT NULL DEFAULT 0,
    "total_earned_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_tracking_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partner_id" UUID NOT NULL,
    "event_type" VARCHAR(20) NOT NULL,
    "booking_id" UUID,
    "user_id" UUID,
    "commission_paise" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "current_rate_paise" INTEGER NOT NULL,
    "suggested_rate_paise" INTEGER NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "reason" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_forecasts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "predicted_occupancy_pct" DECIMAL(5,2) NOT NULL,
    "predicted_adr_paise" INTEGER NOT NULL,
    "predicted_revenue_paise" INTEGER NOT NULL,
    "confidenceLevel" VARCHAR(10) NOT NULL,
    "model_version" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_forecasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "proposal_type" VARCHAR(50) NOT NULL,
    "proposed_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "voting_start_at" TIMESTAMPTZ,
    "voting_end_at" TIMESTAMPTZ,
    "quorum_pct" DECIMAL(5,2) NOT NULL DEFAULT 50.00,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "proposal_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "vote" VARCHAR(10) NOT NULL,
    "weight_units" DECIMAL(12,6) NOT NULL,
    "cast_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "governance_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_distributions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_year" INTEGER NOT NULL,
    "total_amount_paise" INTEGER NOT NULL,
    "total_units_eligible" DECIMAL(12,6) NOT NULL,
    "per_unit_paise" DECIMAL(10,4) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "distributed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividend_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividend_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "distribution_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "units_held" DECIMAL(12,6) NOT NULL,
    "payout_amount_paise" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "dividend_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "launch_date" DATE,
    "hero_image_url" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_manager_configs_hotel_id_provider_key" ON "channel_manager_configs"("hotel_id", "provider");

-- CreateIndex
CREATE INDEX "channel_manager_sync_logs_config_id_created_at_idx" ON "channel_manager_sync_logs"("config_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "seo_landing_pages_slug_key" ON "seo_landing_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_partners_code_key" ON "affiliate_partners"("code");

-- CreateIndex
CREATE INDEX "affiliate_tracking_events_partner_id_created_at_idx" ON "affiliate_tracking_events"("partner_id", "created_at");

-- CreateIndex
CREATE INDEX "pricing_suggestions_hotel_id_date_idx" ON "pricing_suggestions"("hotel_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "demand_forecasts_hotel_id_date_model_version_key" ON "demand_forecasts"("hotel_id", "date", "model_version");

-- CreateIndex
CREATE UNIQUE INDEX "governance_votes_proposal_id_hotel_id_key" ON "governance_votes"("proposal_id", "hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- AddForeignKey
ALTER TABLE "channel_manager_configs" ADD CONSTRAINT "channel_manager_configs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_manager_sync_logs" ADD CONSTRAINT "channel_manager_sync_logs_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "channel_manager_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_landing_pages" ADD CONSTRAINT "seo_landing_pages_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tracking_events" ADD CONSTRAINT "affiliate_tracking_events_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_suggestions" ADD CONSTRAINT "pricing_suggestions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_suggestions" ADD CONSTRAINT "pricing_suggestions_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_forecasts" ADD CONSTRAINT "demand_forecasts_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_votes" ADD CONSTRAINT "governance_votes_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "governance_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dividend_payouts" ADD CONSTRAINT "dividend_payouts_distribution_id_fkey" FOREIGN KEY ("distribution_id") REFERENCES "dividend_distributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
