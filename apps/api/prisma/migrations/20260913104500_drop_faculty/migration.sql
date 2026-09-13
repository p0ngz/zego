-- Takes the faculty grouping back out: one major list again.
--
-- Majors are reference data the seed script rebuilds, so they are cleared
-- first. The unique index on the name below cannot be created while the
-- table still holds the same major under two faculties.
DELETE FROM "Major";

-- DropForeignKey
ALTER TABLE "Major" DROP CONSTRAINT "Major_facultyId_fkey";

-- DropIndex
DROP INDEX "Major_facultyId_idx";

-- DropIndex
DROP INDEX "Major_facultyId_nameTh_key";

-- AlterTable
ALTER TABLE "Major" DROP COLUMN "facultyId";

-- DropTable
DROP TABLE "Faculty";

-- CreateIndex
CREATE UNIQUE INDEX "Major_nameTh_key" ON "Major"("nameTh");

