-- Historial de promociones anuales. Aplicar tras la migración 0001_avisos_i12_initial.
CREATE TABLE "EnrollmentMovement" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sourceCourseId" INTEGER NOT NULL,
    "targetCourseId" INTEGER NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "sourceYear" INTEGER NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "performedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnrollmentMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnrollmentMovement_studentId_createdAt_idx" ON "EnrollmentMovement"("studentId", "createdAt");
CREATE INDEX "EnrollmentMovement_sourceCourseId_targetCourseId_idx" ON "EnrollmentMovement"("sourceCourseId", "targetCourseId");
ALTER TABLE "EnrollmentMovement" ADD CONSTRAINT "EnrollmentMovement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
