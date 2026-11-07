-- Etapa 23: directorio privado por defecto. No publica datos antiguos.
CREATE TABLE IF NOT EXISTS "ContactPreference" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "contactEmail" TEXT,
  "emailVisibleTo" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "phoneVisibleTo" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ContactPreference_userId_key" ON "ContactPreference"("userId");
