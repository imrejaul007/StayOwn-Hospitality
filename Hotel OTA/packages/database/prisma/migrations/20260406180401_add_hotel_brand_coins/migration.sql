-- AlterEnum
ALTER TYPE "CoinType" ADD VALUE 'hotel_brand';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "hotel_brand_coin_burned_paise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "coin_transactions" ADD COLUMN     "hotel_id" UUID;

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "brand_coin_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "brand_coin_name" VARCHAR(100),
ADD COLUMN     "brand_coin_symbol" VARCHAR(20);

-- CreateTable
CREATE TABLE "hotel_brand_coin_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "balance_paise" INTEGER NOT NULL DEFAULT 0,
    "lifetime_earned_paise" INTEGER NOT NULL DEFAULT 0,
    "lifetime_burned_paise" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "hotel_brand_coin_balances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_brand_coin_balances_user_id_idx" ON "hotel_brand_coin_balances"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_brand_coin_balances_user_id_hotel_id_key" ON "hotel_brand_coin_balances"("user_id", "hotel_id");

-- AddForeignKey
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_brand_coin_balances" ADD CONSTRAINT "hotel_brand_coin_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_brand_coin_balances" ADD CONSTRAINT "hotel_brand_coin_balances_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
