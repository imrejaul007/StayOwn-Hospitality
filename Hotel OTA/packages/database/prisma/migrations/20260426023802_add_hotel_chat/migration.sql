-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "deleted_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "partner_api_keys" ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::VARCHAR(50)[];

-- CreateTable
CREATE TABLE "room_service_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "room_number" VARCHAR(20) NOT NULL,
    "guest_name" VARCHAR(100) NOT NULL,
    "service_type" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "items" TEXT,
    "total_amount_paise" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'now',
    "requested_by" UUID,
    "assigned_to" UUID,
    "guest_user_id" UUID,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "room_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_engagements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rez_user_id" VARCHAR(100) NOT NULL,
    "ota_user_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "room_number" VARCHAR(20) NOT NULL,
    "engagement_type" VARCHAR(50) NOT NULL,
    "metadata" JSONB,
    "engaged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_chat_threads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "booking_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "guest_user_id" UUID NOT NULL,
    "staff_user_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "room_chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_type" VARCHAR(20) NOT NULL,
    "sender_name" VARCHAR(100) NOT NULL,
    "message_type" VARCHAR(30) NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_chat_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "booking_id" TEXT,
    "room_number" VARCHAR(20),
    "type" VARCHAR(30) NOT NULL DEFAULT 'general',
    "department" VARCHAR(30) NOT NULL DEFAULT 'front_desk',
    "guest_user_id" UUID NOT NULL,
    "guest_name" VARCHAR(100) NOT NULL,
    "staff_id" TEXT,
    "staff_name" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "unread_guest_count" INTEGER NOT NULL DEFAULT 0,
    "unread_staff_count" INTEGER NOT NULL DEFAULT 0,
    "last_message" VARCHAR(255),
    "last_message_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_chat_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_type" VARCHAR(20) NOT NULL,
    "sender_name" VARCHAR(100) NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" VARCHAR(20) NOT NULL DEFAULT 'text',
    "metadata" JSONB,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_chat_staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "department" VARCHAR(30) NOT NULL,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "is_on_duty" BOOLEAN NOT NULL DEFAULT true,
    "active_chats" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_chat_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_service_requests_hotel_id_status_idx" ON "room_service_requests"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "room_service_requests_booking_id_idx" ON "room_service_requests"("booking_id");

-- CreateIndex
CREATE INDEX "room_service_requests_room_id_idx" ON "room_service_requests"("room_id");

-- CreateIndex
CREATE INDEX "room_service_requests_guest_user_id_idx" ON "room_service_requests"("guest_user_id");

-- CreateIndex
CREATE INDEX "room_service_requests_created_at_idx" ON "room_service_requests"("created_at");

-- CreateIndex
CREATE INDEX "room_engagements_booking_id_idx" ON "room_engagements"("booking_id");

-- CreateIndex
CREATE INDEX "room_engagements_hotel_id_idx" ON "room_engagements"("hotel_id");

-- CreateIndex
CREATE INDEX "room_engagements_ota_user_id_idx" ON "room_engagements"("ota_user_id");

-- CreateIndex
CREATE INDEX "room_engagements_engagement_type_idx" ON "room_engagements"("engagement_type");

-- CreateIndex
CREATE INDEX "room_chat_threads_booking_id_idx" ON "room_chat_threads"("booking_id");

-- CreateIndex
CREATE INDEX "room_chat_threads_hotel_id_idx" ON "room_chat_threads"("hotel_id");

-- CreateIndex
CREATE INDEX "room_chat_threads_guest_user_id_idx" ON "room_chat_threads"("guest_user_id");

-- CreateIndex
CREATE INDEX "room_chat_messages_thread_id_created_at_idx" ON "room_chat_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "room_chat_messages_sender_id_idx" ON "room_chat_messages"("sender_id");

-- CreateIndex
CREATE INDEX "hotel_chat_conversations_hotel_id_idx" ON "hotel_chat_conversations"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_chat_conversations_hotel_id_status_idx" ON "hotel_chat_conversations"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "hotel_chat_conversations_hotel_id_department_idx" ON "hotel_chat_conversations"("hotel_id", "department");

-- CreateIndex
CREATE INDEX "hotel_chat_conversations_guest_user_id_idx" ON "hotel_chat_conversations"("guest_user_id");

-- CreateIndex
CREATE INDEX "hotel_chat_conversations_staff_id_idx" ON "hotel_chat_conversations"("staff_id");

-- CreateIndex
CREATE INDEX "hotel_chat_conversations_created_at_idx" ON "hotel_chat_conversations"("created_at");

-- CreateIndex
CREATE INDEX "hotel_chat_messages_conversation_id_idx" ON "hotel_chat_messages"("conversation_id");

-- CreateIndex
CREATE INDEX "hotel_chat_messages_conversation_id_created_at_idx" ON "hotel_chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "hotel_chat_messages_sender_id_idx" ON "hotel_chat_messages"("sender_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_chat_staff_staff_id_key" ON "hotel_chat_staff"("staff_id");

-- CreateIndex
CREATE INDEX "hotel_chat_staff_hotel_id_idx" ON "hotel_chat_staff"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_chat_staff_department_idx" ON "hotel_chat_staff"("department");

-- CreateIndex
CREATE INDEX "booking_events_booking_id_event_type_idx" ON "booking_events"("booking_id", "event_type");

-- AddForeignKey
ALTER TABLE "room_service_requests" ADD CONSTRAINT "room_service_requests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_service_requests" ADD CONSTRAINT "room_service_requests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_chat_messages" ADD CONSTRAINT "room_chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "room_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_chat_messages" ADD CONSTRAINT "hotel_chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "hotel_chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
