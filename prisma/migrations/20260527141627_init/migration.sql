-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'paused', 'disabled');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('admin_manual', 'claim_confirmed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "telegram_username" TEXT,
    "telegram_id" BIGINT,
    "monthly_price" DECIMAL(10,2) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "started_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_until" DATE,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" TEXT,
    "source" "PaymentSource" NOT NULL DEFAULT 'admin_manual',
    "confirmed_by_telegram_id" BIGINT NOT NULL,
    "payment_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_username_key" ON "users"("telegram_username");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "users_status_paid_until_idx" ON "users"("status", "paid_until");

-- CreateIndex
CREATE INDEX "payments_user_id_payment_date_idx" ON "payments"("user_id", "payment_date");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
