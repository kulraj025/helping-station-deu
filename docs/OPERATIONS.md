# Operations

Running the thing once it is live.

## The first thing to check

`/admin/settings` has a readiness panel. It reads the actual environment and lists what is wrong.
Check it before anything else, because every item on that list is a condition the app will otherwise
fail on quietly.

| Warning | What it actually causes |
| --- | --- |
| `AUTH_SECRET` is the development fallback | Sessions can be forged. Anyone who knows the fallback string can mint a valid token. |
| `NEXT_PUBLIC_APP_URL` is localhost | QR codes and posters point at the developer's machine |
| Per-instance rate limiting | Brute-force protection resets on every cold start and is not shared between instances |
| No captcha | Only the honeypot and the rate limit stand between the form and a bot |
| Pool size of 1 | Serialised queries under load. Correct for the bundled PGlite dev server, wrong in production. |

## Routine checks

| Cadence | Check | Where |
| --- | --- | --- |
| Before every event | Readiness panel is empty | `/admin/settings` |
| Before every event | Database is not near its free-tier cap | Neon console |
| Monthly | Dependabot alerts reviewed | GitHub → Security → Dependabot |
| Monthly | Vercel build has not failed | Vercel → Deployments |
| Per event | Draw completed and verified | `/draw/display` |

## Before a draw

The draw is the part of this app that people will question, so the ordering matters.

1. **Registrations closed.** The `registrationDeadline` has passed.
2. **The pool is locked.** `/admin/draw` → lock. This freezes the participant list and stores a
   hash of it. A locked pool cannot be edited; the only remaining action is a recorded correction.
3. **The commitment is published.** `/rules` shows the seed hash before the draw runs.
4. **The draw runs.** CSPRNG selection, seed revealed afterwards.
5. **Verify.** `/draw/display` recomputes the result from the stored seed and the frozen pool, and
   shows whether it matches. Anyone can do this.

Steps 3 and 4 cannot be reordered without defeating the purpose. The seed commitment is what makes
the result believable, and it is worthless if it is published afterwards.

## When something breaks

### The site is down

1. Vercel → **Deployments**. Is the latest one green?
2. If green, the problem is at runtime → **Functions** → find the error.
3. `DATABASE_URL` unset, expired, or the Neon project suspended is the most common cause. Neon
   suspends free projects after inactivity; open the console to wake it.
4. Redeploy after any environment change. A variable added to the dashboard does not reach the
   deployment already serving traffic.

### Sign-in loops back to the login page

Covered in detail in [`AUTH.md`](AUTH.md#troubleshooting). The two usual causes are a redirect URI
that does not match exactly, and an `AUTH_SECRET` that differs between the two requests handling
the flow.

### A sign-in works but every page 500s

The JWT carries a `userId` that has no matching row — for instance an account deleted from the
database while its session was still valid. Sessions last `AUTH_MAX_AGE`, twelve hours by default.
Lowering it shortens the window.

### The draw verification fails

Do not re-run the draw to "fix" it. A completed draw is immutable, and a second run is the exact
failure the design prevents. Find out what changed between the frozen pool and the current one —
almost always a registration or deletion that happened after the lock — and record a correction
instead.

## Backups

The draw's fairness survives a bad backup, but participant data still matters.

Neon's free tier keeps a few days of point-in-time recovery. For anything you would be upset to
lose, take your own copy:

```bash
pg_dump "$DATABASE_URL" > backup-$(date +%F).sql
```

Worth doing before any draw, and before any manual SQL in the Neon editor. A mistyped `DELETE`
there is immediate and unrecoverable on the free tier.

## Data retention

`DATA_RETENTION_DAYS` (default 180) is displayed in the privacy page and in the admin, but **no job
acts on it**. Removal is deliberate:

- `/admin/export` produces a CSV.
- Delete the participant rows you no longer need.

Audit entries are never edited or removed. That is intentional and is what makes the audit trail
worth having.

## Security posture

What is actually in place:

- bcrypt password hashing, cost 10.
- Rate limiting on both login paths, hashed identifiers so the store holds no raw e-mail.
- A honeypot field plus a timing check on the organiser form.
- Optional Cloudflare Turnstile on registration.
- JWT sessions, twelve hours, invalidated by rotating `AUTH_SECRET`.
- A honeypot on the admin login that is invisible to humans but attractive to bots.
- CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`.
- The client secret never reaches the browser. OAuth buttons are gated by a server-side boolean.
- Every login attempt is written to `LoginAttempt`, including failures with a reason.

What is not in place, and should not be mistaken for covered:

- **No email verification.** A student can register any `@deu.ac.kr`-shaped address they can
  receive mail at. Domain-only checking is a real limit on who gets in, and a real gap too.
- **No admin invitation flow.** Admin rows come from the seed or from manual SQL.
- **No 2FA on the admin account.** Given that `/admin` can run a draw and export every participant,
  this is the most valuable next addition.
- **Rate limiting is per-instance** unless Upstash is configured.
- **No automated retention job.**

## Rotating anything

| Secret | How | Blast radius |
| --- | --- | --- |
| `AUTH_SECRET` | `crypto.randomBytes(32).toString('base64')` | Every session ends |
| `GOOGLE_CLIENT_SECRET` | Google Cloud → Credentials | Nobody can sign in until the new value is deployed |
| `KAKAO_CLIENT_SECRET` | Kakao console | Same |
| `DATABASE_URL` password | Neon console | Connection pool fails until updated everywhere |

Always rotate at the provider first, then deploy. The other order leaves a live credential
unreachable in between.
