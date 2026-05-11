-- CreateEnum
CREATE TYPE "MiningDisputeStatus" AS ENUM ('submitted', 'under_review', 'resolved', 'rejected');

-- CreateTable
CREATE TABLE "mining_disputes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "period_month" DATE NOT NULL,
    "dispute_field" VARCHAR(100) NOT NULL,
    "claim" TEXT NOT NULL,
    "evidence_url" VARCHAR(500),
    "status" "MiningDisputeStatus" NOT NULL DEFAULT 'submitted',
    "admin_note" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mining_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mining_disputes_hotel_id_period_month_idx" ON "mining_disputes"("hotel_id", "period_month");

-- AddForeignKey
ALTER TABLE "mining_disputes" ADD CONSTRAINT "mining_disputes_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
