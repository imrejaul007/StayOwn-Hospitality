-- CreateTable
CREATE TABLE "risk_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "hotel_id" UUID,
    "booking_id" UUID,
    "event_type" VARCHAR(50) NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_type" VARCHAR(50) NOT NULL,
    "stuck_holds" INTEGER NOT NULL DEFAULT 0,
    "missed_checkouts" INTEGER NOT NULL DEFAULT 0,
    "missing_settlements" INTEGER NOT NULL DEFAULT 0,
    "orphaned_transactions" INTEGER NOT NULL DEFAULT 0,
    "wallet_discrepancies" INTEGER NOT NULL DEFAULT 0,
    "issues_found" INTEGER NOT NULL DEFAULT 0,
    "issues_resolved" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_events_user_id_created_at_idx" ON "risk_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "risk_events_event_type_created_at_idx" ON "risk_events"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_admin_user_id_created_at_idx" ON "admin_audit_log"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_entity_type_entity_id_idx" ON "admin_audit_log"("entity_type", "entity_id");
