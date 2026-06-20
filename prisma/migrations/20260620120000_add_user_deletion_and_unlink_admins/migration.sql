-- Restore invitations accidentally activated by their own administrator and unlink
-- the administrator from the corresponding VPN user profile.
CREATE TEMPORARY TABLE "mistaken_admin_invites" AS
SELECT "id", "user_id"
FROM "user_invites"
WHERE "used_by_telegram_id" IS NOT NULL
  AND "created_by_telegram_id" = "used_by_telegram_id";

UPDATE "users"
SET "telegram_id" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (SELECT "user_id" FROM "mistaken_admin_invites");

UPDATE "user_invites"
SET "used_at" = NULL,
    "used_by_telegram_id" = NULL
WHERE "id" IN (SELECT "id" FROM "mistaken_admin_invites");

DROP TABLE "mistaken_admin_invites";

ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_fkey";
ALTER TABLE "payments"
ADD CONSTRAINT "payments_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_claims" DROP CONSTRAINT "payment_claims_user_id_fkey";
ALTER TABLE "payment_claims"
ADD CONSTRAINT "payment_claims_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
