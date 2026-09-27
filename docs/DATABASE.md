# Database

PostgreSQL, accessed through Prisma. The schema is
[`prisma/schema.prisma`](../prisma/schema.prisma).

## Local development

Two options. Neither needs a Postgres install.

**A. The bundled PGlite server** — no install, single connection, ideal for a quick look.

```bash
npm run db:dev
```

Sets `DATABASE_URL` to `postgresql://postgres:postgres@127.0.0.1:5433/helpingstation`. Set
`DB_POOL_MAX=1` to match, since PGlite serves one connection.

**B. Real Postgres** — anything reachable, local or not:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/helpingstation?schema=public"
```

## Migrations

| Command | Use |
| --- | --- |
| `npx prisma migrate dev --name <name>` | Local. Creates and applies a migration. |
| `npx prisma migrate deploy` | Production. Applies pending migrations. Never creates one. |
| `npx prisma db push` | Pushes the schema with no migration file. A last resort, not a workflow. |
| `npx prisma generate` | Regenerates the client. Run after every schema change. |

`prisma generate` is not optional. The client is generated into `src/generated/prisma`, not
`node_modules`, so a fresh `npm install` leaves the app unable to import it until you run it.

### In production

Migrations run from GitHub Actions, not from anyone's laptop.
[`.github/workflows/deploy-migrate.yml`](../.github/workflows/deploy-migrate.yml) runs
`prisma migrate deploy` and then pings the Vercel deploy hook. Run it from the **Actions** tab via
`workflow_dispatch`; no terminal required.

The ordering is the point: the schema is updated first, then the new code is deployed. A deployment
that ships code querying a column the database does not have yet returns a 500 that reads like an
application bug.

### Migrations are additive only

No deployment pipeline here runs a down-migration. A column rename is therefore three deployments:

1. Add the new column, nullable, alongside the old one.
2. Backfill.
3. Switch reads to the new column, then drop the old one.

Do not rename a column in one step on a live database.

## The schema

### `User`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `String` | Primary key. `google_<sub>` for OAuth accounts |
| `email` | `String` | **Unique.** The login identifier |
| `name` | `String` | |
| `studentId` | `String` | **Unique.** Placeholder for OAuth accounts |
| `department` | `String` | `Unknown` for OAuth accounts until an organiser fills it in |
| `role` | `Role` | `STUDENT` or `ADMIN` |
| `passwordHash` | `String?` | `null` for OAuth accounts |
| `claimCodeHash` | `String?` | One-time code for password recovery |
| `isActive` | `Boolean` | Inactive users cannot sign in |
| `isDemo` | `Boolean` | `true` marks rehearsal data |
| `lastLoginAt` | `DateTime?` | |

### `Event`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `String` | Primary key |
| `slug` | `String` | **Unique.** Also the permanent poster URL |
| `name`, `description` | `String` | |
| `locationName` | `String` | |
| `startAt`, `endAt` | `DateTime` | |
| `registrationDeadline` | `DateTime` | |
| `organizerName` | `String` | |
| `status` | `EventStatus` | `DRAFT`, `PUBLISHED`, `LOCKED`, `DRAWN` |
| `allowMultipleWinsPerParticipant` | `Boolean` | Defaults to `false` |

### `Registration`

Joins a `User` to an `Event`, and is the unit the draw operates on.

| Column | Type | Notes |
| --- | --- | --- |
| `eventId`, `userId` | `String` | **Unique together.** One registration per student per event |
| `studentIdSnapshot`, `departmentSnapshot` | `String` | Copied at registration so a later profile edit cannot rewrite history |
| `eligible` | `Boolean` | Decided before the pool freezes |
| `ineligibleReason` | `String?` | |

### `Draw` and `Winner`

`Draw` holds the commitment: `seedCommit` (a hash published before the draw), `seedReveal` (the
value itself, published afterwards), the `poolHash`, and the result. `Winner` records who won what.

A completed draw is immutable. The application refuses to modify one, and that refusal is the
guarantee the whole design rests on.

### `AuditLog` and `LoginAttempt`

Never updated, never deleted. `AuditLog` records who did what; `LoginAttempt` records every login
attempt including failures, with a hashed IP. Together they are what makes a disputed draw
answerable.

## Seeding

```bash
npm run db:seed
```

Idempotent. Creates two accounts, a live event with prizes, a past event, 27 demo registrations
and five winners.

`seed.ts` reads `DATABASE_URL` and falls back to `127.0.0.1:5433`. It loads **`.env`**, not
`.env.local` — if the seed appears to use the wrong database, that is usually why.

**Never seed production.** The seed writes `isDemo = true` rows, but it also creates an admin with
the password from `SEED_ADMIN_PASSWORD`. Change it, or do not run the seed.

## Inspecting and editing

**Prisma Studio** — a local GUI, the closest thing to Django's admin:

```bash
npx prisma studio   # http://localhost:5555
```

**Neon SQL Editor** — for the live database, in a browser:
[console.neon.tech](https://console.neon.tech) → your project → **SQL Editor**.

Useful queries:

```sql
-- Everything, quickly
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Event";
SELECT COUNT(*) FROM "Registration";
SELECT COUNT(*) FROM "Winner";

-- Accounts that can reach /admin
SELECT email, name, "lastLoginAt" FROM "User" WHERE role = 'ADMIN';

-- Recent failed logins
SELECT identifier, reason, "createdAt"
FROM "LoginAttempt"
WHERE success = false
ORDER BY "createdAt" DESC
LIMIT 20;

-- Who is registered for the live event
SELECT u.email, u."studentId", r.eligible, r."ineligibleReason"
FROM "Registration" r
JOIN "User" u ON u.id = r."userId"
JOIN "Event" e ON e.id = r."eventId"
WHERE e.status = 'PUBLISHED';

-- OAuth-created accounts still missing a department
SELECT email, "studentId" FROM "User"
WHERE department = 'Unknown' AND "passwordHash" IS NULL;
```

## Creating an admin by hand

The Organiser tab needs a row that a seed will not provide on a live database.

Generate the hash:

```bash
npx -e "console.log(require('bcryptjs').hashSync('YourSecurePassword', 10))"
```

Then, in the Neon SQL Editor:

```sql
INSERT INTO "User" (id, email, name, studentId, department, role, "passwordHash", "isActive", "isDemo")
VALUES (
  gen_random_uuid()::text,
  'admin@helpingstation.deu',
  'Event Organiser',
  'ADMIN-001',
  'Administration',
  'ADMIN',
  '<paste the bcrypt hash>',
  true,
  false
);
```

`isDemo` must be `false`. And sign in with this on the **Organiser** tab — the student credential
provider independently rejects any row whose role is not `STUDENT`.

## Empty database behaviour

Worth stating, because it looks like a bug and is not. With no `Event` rows:

- `/` and `/register` show "No event is open for registration".
- `/winners` shows no winners.
- `/admin` is reachable, once an admin exists.

Every one of those is the correct response to an empty database. Insert a `PUBLISHED` event with
its prizes and the pages fill in.
