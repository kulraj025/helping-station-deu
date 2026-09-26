# Helping Station DEU

A student volunteer and awareness programme at Dong-Eui University, with a lucky draw that is
designed to be believed: a frozen participant pool, a server-side cryptographic random selection,
a published commitment to the randomness, and a verification step anybody can run afterwards.

The visual language is a university volunteer programme — greens, cream, and clear information —
not a casino. That is deliberate. The draw is a thank-you gesture at the end of a day of
volunteering, and it should look like part of the day, not like a gambling product.

---

## Table of contents

- [What it does](#what-it-does)
- [How the draw is made fair](#how-the-draw-is-made-fair)
- [Privacy by construction](#privacy-by-construction)
- [Stack](#stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Routes](#routes)
- [Data model](#data-model)
- [Tests](#tests)
- [Deploying](#deploying)
- [Design decisions worth knowing](#design-decisions-worth-knowing)
- [Known limitations](#known-limitations)

---

## What it does

**For participants**

- Browse the programme, the event details, and the rules before signing up.
- Register in about a minute. Required consents (participation rules, data processing) and the
  optional ones (public display of a masked name, being contacted about a prize) are separate,
  labelled boxes — never one bundled "I agree".
- Receive an entry number immediately and a printable confirmation card showing **only** the entry
  number.
- Watch the draw live on a projector screen, or from the organiser's own page.
- See winners afterwards, masked or entry-number-only, according to the event's settings.

**For organisers**

- Create and edit events, with a lifecycle (`DRAFT → PUBLISHED → REGISTRATION_CLOSED →
  IN_PROGRESS → COMPLETED → ARCHIVED`) that guards against nonsense transitions.
- Download a QR code and a printable A4 poster for physical promotion.
- Review the participant list, and mark attendance and draw eligibility individually or in bulk.
- Lock the pool, run the draw, and verify the result.
- Track prize claims, append corrections, and never edit a completed draw.
- Export participants, winners, the draw report and the audit log as CSV or JSON.
- Read an append-only audit log of every sensitive action.

---

## How the draw is made fair

The interesting part of this project is the draw, and the design follows from one requirement: a
participant should be able to check the result themselves and get the same answer.

### 1. Eligibility is decided before the pool freezes

Attendance is confirmed and eligibility is set explicitly. When
`requireParticipationForEligibility` is on (the default), an unconfirmed participant is
`PENDING` and is excluded — so somebody who registers and never arrives cannot win.

Draw consent is a separate required box. A participant who does not tick it is excluded from the
pool automatically, whatever their eligibility status says.

### 2. Locking produces a frozen, hashed snapshot

Locking copies the eligible entry numbers into a `DrawPoolEntry` snapshot, ordered by entry number,
and stores a SHA-256 fingerprint of the ordered list. After that:

- the registration deadline is read-only,
- the draw rules are read-only,
- the prize list is read-only,
- participant eligibility is read-only.

Registration must already be closed — the code refuses to lock otherwise. The point is that the
pool cannot change after the commitment, in either direction.

### 3. Selection is CSPRNG-driven, and the seed is committed to in advance

```
commit  = SHA-256(drawId ‖ poolHash ‖ entropy)     ← stored and published before selection
seed    = 32 bytes from crypto.randomInt
shuffle = Fisher-Yates over the snapshot, seeded by HMAC-SHA256(seed, counter)
```

`crypto.randomInt` uses rejection sampling, so there is no modulo bias. Every candidate in the
snapshot has exactly one route to every position, which makes every candidate equally likely to be
first.

The commitment is the part that matters. It is computed and stored **before** any winner is chosen
and published on the same page. A hash cannot be reversed, so the organiser cannot pick a seed
after seeing who would win and re-roll until the result is convenient.

### 4. Winners are stored, then the seed is revealed

On completion the raw entropy is stored and shown. Anybody can now paste the pool hash, the
commitment and the seed into a replay and reproduce the exact permutation.

`verifySelection` does this on the server; the draw console shows the result; and the export page
produces a JSON draw report containing the same three values.

### 5. A completed draw is immutable

There is no re-roll. If something is wrong afterwards — a participant who should not have been in
the pool, a prize awarded in error — the only path is an **appended correction**:

- the original `Winner` row stays exactly as the draw produced it,
- a `DrawCorrection` row records the type, the reason and who decided it,
- the audit log records the action,
- the public winners page shows the correction rather than pretending it never happened.

Rehearsal resets exist for demo events only, and the service refuses them for anything real.

### Testability

All of the above is in `src/lib/draw.ts` as pure, synchronous functions with no database and no
network, which is why the distribution and reproducibility tests in `tests/draw.test.ts` can run
thousands of permutations in seconds.

---

## Privacy by construction

The rule is simple: **a public surface can only ever see an entry number, a masked name, and a
department.** Everything else is a deliberate second click inside the organiser area, or nothing
at all.

| Data | Public | Organiser | CSV export |
| --- | --- | --- | --- |
| Entry number | yes | yes | yes |
| Name | masked, opt-in | full | full |
| Student ID | never | masked in lists, full on demand | masked (default) |
| E-mail | never | after a second click | only with explicit opt-in |
| Phone | never | after a second click | only with explicit opt-in |

Other specifics:

- `publicWinnerLabel` returns `null` — not an empty string, not a placeholder — when a participant
  has not consented to public display. Opting out is absolute.
- `/success` shows the entry number only, and the page is `noindex`.
- `/draw/display` is excluded in `robots.txt`: it is a screen for the room, not a page to search.
- Exports are redacted by default and every download is written to the audit log, including the
  `includeSensitive` decision, so a file leaving the system is always traceable.
- CSV cells that start with `=`, `+`, `-` or `@` are prefixed with an apostrophe, so a
  participant-supplied string cannot become a spreadsheet formula.
- Demo data is flagged with `isDemo` at the row level, uses distinct `HS-DEMO-###` entry numbers
  and `demo###@demo.deu.ac.kr` addresses, and shows a banner on every page. `DEMO_MODE` is
  force-disabled whenever `NODE_ENV=production`.

---

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Server components keep personal data on the server by default |
| Language | TypeScript 5.9, strict | Statuses and roles are `String` in the database, narrowed by validated constants |
| Styling | Tailwind CSS 4 | Design tokens in `globals.css`; no component library look |
| Database | PostgreSQL via Prisma 7 | Real transactions for the draw; `jsonb` for event settings |
| Auth | Auth.js 5 (JWT sessions) | Two credential providers: organiser password, student password or claim code |
| Validation | Zod 4 | One schema per mutation; the server copy is authoritative |
| Passwords | bcryptjs (cost 10) | Adequate, no native build step |
| QR / poster | `qrcode` | SVG and PNG generation server-side |
| Tests | Vitest 3 | Fast, no database required |

Development-only: `tsx` for scripts and the seed, `dotenv`, and
`@electric-sql/pglite` + `@electric-sql/pglite-socket` for a local PostgreSQL that needs no install.

---

## Getting started

### Prerequisites

- Node.js 20.11 or newer
- PostgreSQL 14 or newer (or use the bundled PGlite dev server — see below)

### 1. Install and configure

```bash
npm install
cp .env.example .env
```

Then generate a real secret and put it in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Minimum `.env`:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/helpingstation"
AUTH_SECRET="<the value you just generated>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 2. Database

**With a real PostgreSQL server:**

```bash
npm run db:migrate      # apply migrations
npm run db:seed         # demo organiser, student, and two demo events
```

**With the bundled PGlite dev server** (no PostgreSQL install, single connection only):

```bash
npm run db:dev          # terminal 1 — PGlite on 127.0.0.1:5433, data in .pgdata
```

Then, in terminal 2, set `DB_POOL_MAX=1` in `.env` — PGlite's socket server accepts one client at a
time, so a larger pool will hang. After any Prisma process exits abnormally, restart
`npm run db:dev` before the next one.

### 3. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### Demo accounts

Created by `npm run db:seed`:

| Role | E-mail | Password |
| --- | --- | --- |
| Organiser | `admin@helpingstation.deu` | `ChangeMe!2024` |
| Student | `student@deu.ac.kr` | `ChangeMe!2024` |

Change them before using this for anything real. The seed is idempotent, so it can be re-run.

---

## Environment variables

| Variable | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `AUTH_SECRET` | yes in production | dev fallback | Generated with `crypto.randomBytes(32)` |
| `NEXT_PUBLIC_APP_URL` | yes | `http://localhost:3000` | Used in QR codes, the sitemap and share links |
| `DB_POOL_MAX` | no | `10` | Set to `1` for the bundled PGlite server |
| `DEMO_MODE` | no | `true` in dev | Force-disabled when `NODE_ENV=production` |
| `CONTACT_EMAIL` | no | `helpingstation@deu.ac.kr` | Shown in the footer |
| `ORGANIZER_NAME` | no | Helping Station DEU | Shown as the site author |
| `DATA_RETENTION_DAYS` | no | `180` | Stated in the privacy page |
| `AUTH_TRUST_HOST` | no | `true` | Required behind some proxies |
| `AUTH_MAX_AGE` | no | `43200` | Session lifetime in seconds |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | no | — | Both needed to enable the captcha |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | — | Both needed for a shared rate limit |
| `NOTIFICATIONS_ENABLED` | no | `false` | Records notification rows; delivery is not wired up |
| `NOTIFICATION_FROM_EMAIL` | no | `no-reply@helpingstation.deu` | |

Missing optional integrations degrade rather than fail: no Turnstile means the honeypot and rate
limit only, no Upstash means per-instance rate limiting. The admin settings page reports all of
this, including whether `AUTH_SECRET` is still the development fallback.

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` then `next build` |
| `npm run start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint via `next lint` |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Idempotent demo seed |
| `npm run db:push` | Push the schema without a migration |
| `npm run db:studio` | Prisma Studio |
| `npm run db:dev` | Bundled PGlite dev database |
| `npm run setup` | Guided first-run setup |

---

## Routes

### Public

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/event` | The programme: activities, schedule, what to bring, FAQ |
| `/event/[slug]` | A specific event — the permanent link for posters |
| `/register` | Registration form (`?event=slug` selects the event) |
| `/success?entry=…` | Printable confirmation, entry number only, `noindex` |
| `/draw` | The draw, for participants |
| `/draw/display` | Projector view: no navbar, dark, self-updating |
| `/winners` | Winners across events |
| `/rules` | The published rules, with anchors per section |
| `/privacy` | What is collected, and what is never published |
| `/login` | Sign in |
| `/account` | Own registrations, entry numbers, claim code, cancel |

### Organiser (`/admin`, requires the `ADMIN` role)

| Route | Purpose |
| --- | --- |
| `/admin` | Dashboard: next step, counts, warnings, recent activity |
| `/admin/events` | Event list; `/new`; `/[id]` to edit |
| `/admin/participants` | Participant list with inline eligibility editing |
| `/admin/eligibility` | Attendance and eligibility dashboard, bulk editing |
| `/admin/prizes` | Prize table (order and quantity are part of the draw definition) |
| `/admin/draw` | Lock, run, verify, and the published algorithm |
| `/admin/winners` | Claim tracking, notes, append-only revocations |
| `/admin/audit` | Append-only log, filterable by action |
| `/admin/export` | CSV/JSON export with an explicit personal-data opt-in |
| `/admin/settings` | Deployment readiness, environment, your account |

Every admin page except `/admin/audit` and `/admin/settings` is scoped to the event chosen in the
sidebar switcher, via `?event=<id>`.

### API

| Route | Purpose |
| --- | --- |
| `/api/auth/[...nextauth]` | Auth.js handlers |
| `/api/public/event` | Minimal public event JSON |
| `/api/public/draw-state` | Polled by the draw stage |
| `/api/events/[id]/qr` | QR as SVG or PNG |
| `/api/events/[id]/poster` | A4 poster as SVG |
| `/api/admin/export` | CSV/JSON export; logs every download |

---

## Data model

```
User ──< Registration >── Event ──< Prize
  │                          │          │
  │                          │          └──< Winner >── Draw ──< DrawPoolEntry
  │                          │                │              (>── Registration)
  │                          ├──< AuditLog    └──< DrawCorrection
  │                          └──< Notification
  └──< AuditLog
```

Notable fields:

- `Registration.entryNumber` — unique per event; the public identifier.
- `Registration.participationStatus` / `drawEligibility` — decided by a human, not inferred.
- `Registration.drawConsentAt` / `contactConsentAt` / `publicDisplayConsent` — separate consents with
  their own timestamps.
- `Event.settings` — `jsonb`, validated by `eventSettingsSchema`, with a default for every key so a
  corrupt or partial value cannot break a page.
- `Draw.poolSnapshotHash`, `selectionDigest`, `selectionEntropy`, `idempotencyKey` — the integrity
  record. `idempotencyKey` is unique, which is what makes a second run of the same locked pool
  impossible.
- `Winner.revokedReason` and `DrawCorrection` — corrections are additive; nothing is rewritten.

Statuses and roles are stored as `String` and validated by the constants in `src/lib/constants.ts`.
This keeps the schema migratable while still refusing unknown values at the edge.

---

## Tests

```bash
npm test
```

Pure logic only — no database, no network. That is a deliberate constraint: these are the parts
that must be correct without any infrastructure, and a test suite that needs PGlite running is a
test suite that stops being run.

| File | What it covers |
| --- | --- |
| `tests/draw.test.ts` | CSPRNG uniformity, permutation integrity, reproducibility from published data, commitment tampering, shortfall handling, fairness across many runs |
| `tests/privacy.test.ts` | Name/ID/e-mail/phone masking, and that `publicWinnerLabel` returns `null` when consent is absent |
| `tests/csv.test.ts` | RFC 4180 escaping, formula-injection neutralisation, redacted-by-default columns, safe filenames |
| `tests/entry-number.test.ts` | Padding, uniqueness across gaps, demo prefixes, slug generation |
| `tests/validation.test.ts` | Every Zod schema, including the cross-field date rules and the consent requirements |

The fairness test is worth singling out: 900 independent draws with three candidates, asserting each
wins roughly a third of the time. A biased shuffle or a modulo artefact fails it.

---

## Deploying

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (absolute, not localhost) and `DB_POOL_MAX`.
3. Leave `DEMO_MODE` off, or set it explicitly — it is force-disabled under
   `NODE_ENV=production` regardless.
4. `npm run db:deploy` then `npm run build` then `npm run start`.
5. Open `/admin/settings` and read the readiness panel. It lists the real problems: a development
   `AUTH_SECRET`, a localhost public URL, per-instance rate limiting, no captcha, a pool size of 1.

`next.config.ts` sets a Content-Security-Policy plus `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options` and `Permissions-Policy`. If you add a third-party script, add
it to the CSP in the same change.

---

## Design decisions worth knowing

**One winner per event, by default.** `allowMultipleWinsPerParticipant` exists but is off. A
student volunteering for a day should not be able to win two prizes.

**Irreversible actions ask you to type a code.** Locking the pool and running the draw both require
typing the first six characters of the event slug. It is a small speed bump whose only purpose is
to make sure the click was deliberate.

**A locked pool is genuinely frozen.** Not "warned about" — the server action returns an error. The
organiser's only remaining tool is a correction, which is the honest representation of what
happened.

**Nothing is deleted.** Audit entries are never edited or removed. Prize deletion is refused once a
winner exists. The only destructive operation in the system is a demo-event rehearsal reset, and it
refuses to run against anything with `isDemo = false`.

**The rules page is not marketing copy.** It is the same commitment the code enforces, in words a
participant can read before registering.

**Confirmations show an entry number, not a name.** `/success` is what a participant screenshots
and shares, and it carries nothing worth redacting.

---

## Known limitations

Stated plainly, because a README that claims completeness is not useful.

- **Notification delivery is not implemented.** `notifyWinnerAction` creates a `Notification` row and
  writes the audit entry; nothing sends an e-mail or an SMS. Wire up a provider behind
  `NOTIFICATIONS_ENABLED`.
- **There is no automated retention job.** `DATA_RETENTION_DAYS` is documented in the privacy page
  and displayed in the admin, but records must be removed deliberately.
- **Admin accounts are created by the seed only.** There is no invitation or user-management screen;
  in a real deployment this would be the first thing to add.
- **Attendance is a single status per participant.** There is no check-in kiosk, no QR scanning and
  no per-activity tracking, so an organiser working a paper sheet is the realistic workflow.
- **Rate limiting is in-process by default.** Set the Upstash variables before running more than one
  instance.
- **The captcha is optional.** Without Turnstile, only the honeypot and the rate limit stand between
  the form and a determined bot.
- **`next lint` is deprecated** in Next 15 and will be removed; the ESLint configuration is present
  and working, but the command itself is on its way out.

---

## Licence

Provided as-is for the Helping Station DEU student programme.
