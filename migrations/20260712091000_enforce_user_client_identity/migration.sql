-- User.clientProfile is the canonical inverse of Client.user.
-- The preflight block refuses to add uniqueness if existing data violates one User -> one Client.
DO $$
BEGIN
  IF EXISTS (
    SELECT "user"
    FROM "Client"
    WHERE "user" IS NOT NULL
    GROUP BY "user"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Client.user uniqueness: duplicate User relationships exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Client_user_key" ON "Client"("user");
