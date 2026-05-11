-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "stay_registrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "stay_date" DATE NOT NULL,
    "receipt_image_url" TEXT NOT NULL,
    "ocr_extracted_data" JSONB,
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "reviewer_id" UUID,
    "rejection_reason" TEXT,
    "coins_awarded_paise" INTEGER NOT NULL DEFAULT 0,
    "coin_transaction_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,

    CONSTRAINT "stay_registrations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stay_registrations" ADD CONSTRAINT "stay_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_registrations" ADD CONSTRAINT "stay_registrations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
