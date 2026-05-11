-- AlterTable
ALTER TABLE "offline_payments" ADD COLUMN     "bill_amount_paise" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "ota_coin_burned_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "payment_method" VARCHAR(20),
ADD COLUMN     "razorpay_order_id" VARCHAR(255),
ADD COLUMN     "rez_coin_burned_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shadow_stay_created" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN     "stay_date" DATE,
ADD COLUMN     "transaction_fee_paise" INTEGER NOT NULL DEFAULT 0;
