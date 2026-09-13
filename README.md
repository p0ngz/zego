# Zego — job application

A Thai job application form, in Thai and English, built from the
`Applicant Information` design. Six steps, roughly ninety questions, with
real Thailand Post geography behind the address fields and a server that
re-checks everything the browser checked.

```
packages/shared   the form's questions, and the rules they are checked by
apps/api          Express + Prisma + Postgres
apps/web          React + Vite
```

## Running it

```bash
cp .env.example .env
docker compose up -d db                              # Postgres on :5440
npm install
npm run db:migrate  --workspace=@zego/api            # create the tables
npm run db:seed     --workspace=@zego/api            # load the reference data
npm run dev:api                                      # :3003
npm run dev:web                                      # :3002
```

Open http://localhost:3002.

Set `APP_ENCRYPTION_KEY` in `.env` before you start, or ID numbers are
stored as they were typed:

```bash
openssl rand -base64 32
```

Without it the server logs a warning in development and refuses to start
in production.

## The one idea worth knowing

Every question lives in one list, in
[`packages/shared/src/catalog.ts`](packages/shared/src/catalog.ts) — its
label in both languages, its type, whether it is required, and when it is
asked at all. The React form renders that list, and the Express route
validates against the same list before storing anything. Adding a
question means adding one entry, and both ends pick it up.

The rules themselves are in
[`validation.ts`](packages/shared/src/validation.ts). The browser runs
them a step at a time; the server runs all of them at once on submit, so
a request that never went near the form still has to be complete.

## Reference data

| What | Where it comes from | Rows |
| --- | --- | --- |
| Provinces, districts, sub-districts, post codes | [thailand-geography-json](https://github.com/thailand-geography-data/thailand-geography-json) | 7,436 sub-districts across 956 post codes |
| Institutions | curated, Thai and English | 131 |
| Majors | curated, Thai and English | 88 |

Refresh the geography file with
`npm run db:geo --workspace=@zego/api`, then reseed.

Typing a post code fetches that one code rather than shipping the whole
table to the browser; the province fills itself in and the district and
sub-district become lists filtered to that code. The server then confirms
on submit that the district really does sit under the post code given.

## Personal data

The form asks for a national ID number, religion, race, and whether the
applicant has had a serious illness. Under Thailand's PDPA those are
sensitive personal data.

What is in place:

- The ID number is encrypted with AES-256-GCM before it reaches the
  database, and reads back masked to the last four digits.
- The draft kept in the browser leaves all of those answers out — the
  machine may not belong to the applicant.
- Submitting is rate limited per IP.

What is **not** in place, and is a decision for whoever runs this:

- **Consent.** The checkbox on the last step certifies the answers are
  true. It is not consent to process sensitive data, which PDPA section
  26 wants asked separately and explicitly.
- **Retention.** Nothing expires. Applications stay until deleted by hand.
- **Access control.** `GET /api/applications` is open. It needs to be
  behind a login before this is reachable from anywhere real.

## API

| | |
| --- | --- |
| `GET /api/health` | liveness |
| `GET /api/reference?lang=th` | institution and major lists |
| `GET /api/reference/postcodes/:code` | one post code, both languages |
| `POST /api/applications` | submit — validates, encrypts, stores |
| `GET /api/applications` | list, newest first |
| `GET /api/applications/:reference` | one application, ID masked |

## Commands

```bash
npm run typecheck                       # all three packages
npm run test --workspace=@zego/api      # integration tests, needs the database
npm run build                           # api bundle + web bundle
npm run db:studio --workspace=@zego/api # browse the data
```

The tests run against the seeded development database rather than a
stubbed one — the post code check is most of what is worth testing, and a
stub would only prove the stub works. They clean up the rows they create.
