-- Counts submissions per sender, so a public form cannot be flooded.
--
-- A counter held in memory is useless on serverless: every request can
-- get its own instance, so it starts again from zero almost every time.
-- This one is shared because it is in the database. Rows carry a salted
-- hash rather than an address, and are deleted once past the window.

-- CreateTable
CREATE TABLE "SubmissionAttempt" (
    "id" SERIAL NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionAttempt_fingerprint_at_idx" ON "SubmissionAttempt"("fingerprint", "at");

-- CreateIndex
CREATE INDEX "SubmissionAttempt_at_idx" ON "SubmissionAttempt"("at");

