-- Etapa 31: legajos opcionales y seguimiento de correo de verificación.
-- Los legajos anteriores se conservan.
ALTER TABLE "StudentProfile" ALTER COLUMN "legajoStudent" DROP NOT NULL;
ALTER TABLE "TeacherProfile" ALTER COLUMN "legajoTeacher" DROP NOT NULL;
ALTER TABLE "PreceptorProfile" ALTER COLUMN "legajoPreceptor" DROP NOT NULL;

ALTER TABLE "EmailVerificationToken"
  ADD COLUMN "sentAt" TIMESTAMP(3),
  ADD COLUMN "lastError" TEXT;

-- Retiro de Gemini: herramienta no utilizada por Avisos I12.
-- Se eliminan también las credenciales Gemini almacenadas en esas columnas.
ALTER TABLE "InstitutionIntegrationSettings"
  DROP COLUMN "geminiEnabled",
  DROP COLUMN "geminiModel",
  DROP COLUMN "geminiSecret";
