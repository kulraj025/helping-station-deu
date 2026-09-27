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
- [Signing in](#signing-in)
- [Commands](#commands)
- [Routes](#routes)
- [Data model](#data-model)
- [Tests](#tests)
- [Deploying](#deploying)
- [Further documentation](#further-documentation)
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
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | — | Both needed to enable Google sign-in |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | no | — | Both needed to enable the captcha |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | no | — | Both needed for a shared rate limit |
| `NOTIFICATIONS_ENABLED` | no | `false` | Records notification rows; delivery is not wired up |
| `NOTIFICATION_FROM_EMAIL` | no | `no-reply@helpingstation.deu` | |

Missing optional integrations degrade rather than fail: no Turnstile means the honeypot and rate
limit only, no Upstash means per-instance rate limiting. The admin settings page reports all of
this, including whether `AUTH_SECRET` is still the development fallback.

---

## Signing in

Students can authenticate in three ways. Organisers only ever use e-mail and password.

| Method | Needs | Notes |
| --- | --- | --- |
| Password | an account row | The default. Created on first registration. |
| Claim code | an account row + the one-time code | Shown once at registration, for people who lose the password. |
| Google | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Any `@deu.ac.kr` address. |

### How the OAuth buttons behave

- The buttons are only rendered on the **Student** tab, and only when the matching environment
  variables are present. Nothing to configure in code, and no dead buttons in a fresh clone.
- The enabled/disabled decision is made **on the server** in `src/app/(site)/login/page.tsx` and
  handed to the form as a boolean. The form is a client component, and `GOOGLE_CLIENT_ID` is not a
  `NEXT_PUBLIC_` variable, so it is stripped from the browser bundle. Reading the variable inside
  the form would render the button during SSR and then delete it on hydration.
- The client secret is never sent to the browser. Only the server exchanges the authorisation
  code for tokens.
- First sign-in **provisions a `STUDENT` row automatically** with `passwordHash: null` and
  `department: "Unknown"`. An organiser fills in the real department later from
  `/admin/participants`. The Google identity is stored as the primary key, so re-linking an
  existing e-mail is not attempted and cannot be hijacked by matching on a provider ID.
- Any address outside `@deu.ac.kr` is rejected before a row is written, and the user is sent back
  to `/login` with an explanatory message rather than a bare OAuth error blob.

### Setting up Google

Google is the only OAuth provider in this deployment. Google now requires 2-Step Verification on the
account that owns the Cloud project, so have an authenticator app ready before you start.

1. [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → OAuth consent screen**. Configure it, then either publish it or list your
   own address under **Test users**. An unconfigured consent screen fails every request.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
   - Authorized JavaScript origin: `https://your-app.example.com`
   - Authorized redirect URI: `https://your-app.example.com/api/auth/callback/google`
5. Copy the client ID and client secret into the two environment variables above and redeploy.

The redirect URI must match **exactly** — scheme, host, path, and no trailing slash. A mismatch
produces `redirect_uri_mismatch`, which Google reports only on the consent screen, not in the
Vercel logs, so check it first when a sign-in loops back to the login page.

