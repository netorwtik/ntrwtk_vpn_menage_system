-- CreateEnum
CREATE TYPE "PaymentClaimStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateTable
CREATE TABLE "payment_claims" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentClaimStatus" NOT NULL DEFAULT 'pending',
    "payment_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" BIGINT,

    CONSTRAINT "payment_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_claims_payment_id_key" ON "payment_claims"("payment_id");

-- CreateIndex
CREATE INDEX "payment_claims_user_id_status_created_at_idx" ON "payment_claims"("user_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_claims" ADD CONSTRAINT "payment_claims_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
