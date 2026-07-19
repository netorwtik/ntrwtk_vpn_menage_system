ALTER TABLE "users"
ALTER COLUMN "payment_due_day" DROP DEFAULT,
ALTER COLUMN "payment_due_day" DROP NOT NULL;

UPDATE "users" AS "u"
SET "payment_due_day" = EXTRACT(DAY FROM "first_payments"."payment_date")::INTEGER,
    "updated_at" = CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON ("user_id")
    "user_id",
    "payment_date"
  FROM "payments"
  ORDER BY "user_id", "payment_date" ASC, "created_at" ASC
) AS "first_payments"
WHERE "u"."id" = "first_payments"."user_id";

UPDATE "users"
SET "payment_due_day" = NULL,
    "updated_at" = CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "payments"
  WHERE "payments"."user_id" = "users"."id"
);
