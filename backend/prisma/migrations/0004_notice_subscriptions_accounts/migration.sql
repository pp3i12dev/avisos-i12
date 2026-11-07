-- Etapa 18: ADDITIVE. No elimina Course/StudentCourse ni sus registros anteriores.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "level" INTEGER;
ALTER TABLE "Course" ADD CONSTRAINT "Course_level_check" CHECK ("level" IS NULL OR "level" BETWEEN 1 AND 12);

CREATE TABLE "StudentCareer" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
  "careerId" INTEGER NOT NULL REFERENCES "Career"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentCareer_studentId_careerId_key" UNIQUE("studentId", "careerId")
);
CREATE INDEX "StudentCareer_careerId_idx" ON "StudentCareer"("careerId");

CREATE TABLE "StudentNoticeSubscription" (
  "id" SERIAL PRIMARY KEY,
  "studentId" INTEGER NOT NULL REFERENCES "StudentProfile"("id") ON DELETE CASCADE,
  "courseId" INTEGER NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
  "subjectId" INTEGER NOT NULL REFERENCES "Subject"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentNoticeSubscription_studentId_courseId_subjectId_key" UNIQUE("studentId", "courseId", "subjectId")
);
CREATE INDEX "StudentNoticeSubscription_courseId_subjectId_idx" ON "StudentNoticeSubscription"("courseId", "subjectId");
CREATE INDEX "StudentNoticeSubscription_studentId_idx" ON "StudentNoticeSubscription"("studentId");

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'STAFF_REGISTRATION_REQUEST';

CREATE TABLE "StaffSignupRequest" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "role" "InvitedRole" NOT NULL,
  "legajo" TEXT,
  "specialty" TEXT,
  "shift" "Shift",
  "position" TEXT,
  "status" "StudentSignupStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewedById" INTEGER,
  "rejectionReason" TEXT
);
CREATE INDEX "StaffSignupRequest_status_role_createdAt_idx" ON "StaffSignupRequest"("status", "role", "createdAt");

CREATE TABLE "EmailVerificationToken" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3)
);
CREATE INDEX "EmailVerificationToken_userId_expiresAt_idx" ON "EmailVerificationToken"("userId", "expiresAt");

-- Migración inicial conservadora de pertenencias de las matrículas anteriores.
INSERT INTO "StudentCareer" ("studentId", "careerId")
SELECT DISTINCT sc."studentId", c."careerId"
FROM "StudentCourse" sc JOIN "Course" c ON c."id" = sc."courseId"
WHERE c."careerId" IS NOT NULL
ON CONFLICT ("studentId", "careerId") DO NOTHING;

-- Inscripciones anteriores: ofrecer por defecto las materias efectivamente asignadas a su curso.
INSERT INTO "StudentNoticeSubscription" ("studentId", "courseId", "subjectId")
SELECT DISTINCT sc."studentId", ts."courseId", ts."subjectId"
FROM "StudentCourse" sc
JOIN "TeacherSubject" ts ON ts."courseId" = sc."courseId" AND ts."isActive" = TRUE
JOIN "Subject" s ON s."id" = ts."subjectId" AND s."isActive" = TRUE AND s."deletedAt" IS NULL
ON CONFLICT ("studentId", "courseId", "subjectId") DO NOTHING;
