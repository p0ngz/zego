-- CreateEnum
CREATE TYPE "InstitutionKind" AS ENUM ('UNIVERSITY', 'RAJABHAT', 'RAJAMANGALA', 'PRIVATE', 'VOCATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('NEW', 'REVIEWING', 'INTERVIEW', 'OFFER', 'REJECTED');

-- CreateTable
CREATE TABLE "Province" (
    "code" INTEGER NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "District" (
    "code" INTEGER NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "provinceCode" INTEGER NOT NULL,

    CONSTRAINT "District_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Subdistrict" (
    "code" INTEGER NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "postalCode" VARCHAR(5) NOT NULL,
    "districtCode" INTEGER NOT NULL,

    CONSTRAINT "Subdistrict_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" SERIAL NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "kind" "InstitutionKind" NOT NULL DEFAULT 'UNIVERSITY',

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Major" (
    "id" SERIAL NOT NULL,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "group" TEXT NOT NULL,

    CONSTRAINT "Major_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "lang" VARCHAR(2) NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'NEW',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tel" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "repeats" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Province_nameTh_idx" ON "Province"("nameTh");

-- CreateIndex
CREATE INDEX "District_provinceCode_idx" ON "District"("provinceCode");

-- CreateIndex
CREATE INDEX "District_nameTh_idx" ON "District"("nameTh");

-- CreateIndex
CREATE INDEX "Subdistrict_postalCode_idx" ON "Subdistrict"("postalCode");

-- CreateIndex
CREATE INDEX "Subdistrict_districtCode_idx" ON "Subdistrict"("districtCode");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_nameTh_key" ON "Institution"("nameTh");

-- CreateIndex
CREATE INDEX "Institution_nameTh_idx" ON "Institution"("nameTh");

-- CreateIndex
CREATE UNIQUE INDEX "Major_nameTh_key" ON "Major"("nameTh");

-- CreateIndex
CREATE INDEX "Major_nameTh_idx" ON "Major"("nameTh");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_submittedAt_idx" ON "Application"("submittedAt");

-- CreateIndex
CREATE INDEX "Application_email_idx" ON "Application"("email");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- AddForeignKey
ALTER TABLE "District" ADD CONSTRAINT "District_provinceCode_fkey" FOREIGN KEY ("provinceCode") REFERENCES "Province"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subdistrict" ADD CONSTRAINT "Subdistrict_districtCode_fkey" FOREIGN KEY ("districtCode") REFERENCES "District"("code") ON DELETE CASCADE ON UPDATE CASCADE;
