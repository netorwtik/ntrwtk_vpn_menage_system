-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('payment_overdue');

-- CreateTable
CREATE TABLE "reminder_deliveries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ReminderKind" NOT NULL,
    "reminder_date" DATE NOT NULL,
    "telegram_message_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reminder_deliveries_kind_reminder_date_idx" ON "reminder_deliveries"("kind", "reminder_date");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_deliveries_user_id_kind_reminder_date_key" ON "reminder_deliveries"("user_id", "kind", "reminder_date");

-- AddForeignKey
ALTER TABLE "reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
