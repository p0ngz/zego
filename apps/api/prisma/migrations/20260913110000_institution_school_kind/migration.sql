-- Adds SCHOOL to the kinds of institution.
--
-- The education step now follows the level chosen beside it: a school for
-- someone who finished at M.6, a technical college for a vocational
-- certificate, a university for a degree. Secondary schools had nowhere to
-- sit before this.
--
-- Institutions are reference data the seed script rebuilds, so the rows
-- themselves are replaced rather than re-tagged.
ALTER TYPE "InstitutionKind" ADD VALUE IF NOT EXISTS 'SCHOOL';
