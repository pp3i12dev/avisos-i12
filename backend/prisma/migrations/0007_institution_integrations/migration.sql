CREATE TABLE "InstitutionIntegrationSettings" (
    "id" SERIAL NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "smtpEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT,
    "smtpSecret" TEXT,
    "geminiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "geminiModel" TEXT DEFAULT 'gemini-2.5-flash',
    "geminiSecret" TEXT,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vapidPublicKey" TEXT,
    "vapidPrivateKey" TEXT,
    "vapidSubject" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" INTEGER,
    CONSTRAINT "InstitutionIntegrationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InstitutionIntegrationSettings_institutionId_key" ON "InstitutionIntegrationSettings"("institutionId");
ALTER TABLE "InstitutionIntegrationSettings" ADD CONSTRAINT "InstitutionIntegrationSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InstitutionIntegrationAudit" (
    "id" SERIAL NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstitutionIntegrationAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InstitutionIntegrationAudit_institutionId_createdAt_idx" ON "InstitutionIntegrationAudit"("institutionId", "createdAt");
ALTER TABLE "InstitutionIntegrationAudit" ADD CONSTRAINT "InstitutionIntegrationAudit_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactPreference" ADD COLUMN "contactPhone" TEXT;
