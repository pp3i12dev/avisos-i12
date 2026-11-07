-- Etapa 21: cobertura informativa de preceptorías por carrera y turno.
-- Migración aditiva: preserva PreceptorProfile.shift anterior y todos los preceptores.
ALTER TABLE "StaffSignupRequest" ADD COLUMN "coverages" JSONB;
CREATE TABLE "PreceptorCoverage" (
  "id" SERIAL NOT NULL,
  "preceptorId" INTEGER NOT NULL,
  "careerId" INTEGER NOT NULL,
  "shift" "Shift" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PreceptorCoverage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PreceptorCoverage_preceptorId_careerId_shift_key"
  ON "PreceptorCoverage"("preceptorId", "careerId", "shift");
CREATE INDEX "PreceptorCoverage_careerId_shift_idx"
  ON "PreceptorCoverage"("careerId", "shift");
ALTER TABLE "PreceptorCoverage" ADD CONSTRAINT "PreceptorCoverage_preceptorId_fkey"
  FOREIGN KEY ("preceptorId") REFERENCES "PreceptorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PreceptorCoverage" ADD CONSTRAINT "PreceptorCoverage_careerId_fkey"
  FOREIGN KEY ("careerId") REFERENCES "Career"("id") ON DELETE CASCADE ON UPDATE CASCADE;
