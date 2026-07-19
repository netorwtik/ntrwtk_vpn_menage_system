ALTER TABLE "users"
ADD COLUMN "payment_due_day" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "users"
ADD CONSTRAINT "users_payment_due_day_check" CHECK ("payment_due_day" BETWEEN 1 AND 31);

ALTER TABLE "user_invites" DROP CONSTRAINT IF EXISTS "user_invites_user_id_fkey";
ALTER TABLE "user_invites"
ADD CONSTRAINT "user_invites_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
