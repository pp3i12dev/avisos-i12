-- Cursos pueden desactivarse sin perder inscripciones ni cambiar sus IDs.
ALTER TABLE "Course" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX "Course_institutionId_isActive_idx" ON "Course"("institutionId", "isActive");
