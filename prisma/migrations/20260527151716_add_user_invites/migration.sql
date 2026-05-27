-- CreateTable
CREATE TABLE "user_invites" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_telegram_id" BIGINT,
    "created_by_telegram_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_invites_token_hash_key" ON "user_invites"("token_hash");

-- CreateIndex
CREATE INDEX "user_invites_user_id_created_at_idx" ON "user_invites"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_invites" ADD CONSTRAINT "user_invites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
