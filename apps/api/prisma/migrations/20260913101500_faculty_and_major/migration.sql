-- Splits the single major list into faculties and the majors under them.
--
-- Majors are reference data loaded by the seed script, so they are cleared
-- and rebuilt rather than back-filled: every row is about to be replaced by
-- one carrying a faculty. Applications are untouched — an application keeps
-- the major as the text that was submitted, not as a foreign key.
DELETE FROM "Major";

-- DropIndex
DROP INDEX "Major_nameTh_key";

-- AlterTable
ALTER TABLE "Major" DROP COLUMN "group",
ADD COLUMN     "facultyId" INTEGER;

-- CreateTable
CREATE TABLE "Faculty" (
    "id" SERIAL NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_nameTh_key" ON "Faculty"("nameTh");

-- CreateIndex
CREATE INDEX "Faculty_nameTh_idx" ON "Faculty"("nameTh");

-- CreateIndex
CREATE INDEX "Major_facultyId_idx" ON "Major"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Major_facultyId_nameTh_key" ON "Major"("facultyId", "nameTh");

-- AddForeignKey
ALTER TABLE "Major" ADD CONSTRAINT "Major_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
