# Deployment

The path that produced the live site, plus the mistakes worth skipping.

## Live deployment

| | |
| --- | --- |
| Application | `https://helping-station-deu1.vercel.app` |
| Host | Vercel (Hobby) |
| Database | Neon PostgreSQL (free tier) |
| Migrations | GitHub Actions → `prisma migrate deploy` → Vercel deploy hook |
| Repository | `kulraj025/helping-station-deu` |

The combination is deliberate. Vercel's Hobby tier is free forever with no card, and Neon's free
tier does not expire. Render's free PostgreSQL, by contrast, is deleted after 90 days of
inactivity, which makes it a poor fit for a database that should simply keep existing.

## Without a terminal

Every step below is a button in a browser. No CLI, no `vercel` install, no SSH.

### 1. Create the database

1. [neon.tech](https://neon.tech) → sign up → **Create a project**.
2. Choose a region near the users. South Korea or Singapore is sensible for a Korean university.
3. **Connect** → copy the connection string. It looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require`.
4. Keep it. This is `DATABASE_URL`.

### 2. Create the Vercel project

1. [vercel.com](https://vercel.com) → sign up with GitHub.
2. **Add New → Project** → import `kulraj025/helping-station-deu`.
3. Framework preset **Next.js**. Leave the build command as `npm run build`.
4. Deploy. This first deploy is expected to fail at runtime, because there is no database yet. That
   is fine — it gets you the project URL.

### 3. Set the environment variables

**Project → Settings → Environment Variables.** For each row: **Key**, **Value**, and tick
**Production**.

| Key | Type | Value |
| --- | --- | --- |
| `DATABASE_URL` | Secret | The Neon string from step 1 |
| `AUTH_SECRET` | Secret | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `NEXT_PUBLIC_APP_URL` | Config | `https://<your-project>.vercel.app` |
| `GOOGLE_CLIENT_ID` | Secret | From Google Cloud, if using Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Secret | From Google Cloud |
| `KAKAO_CLIENT_ID` | Secret | The Kakao REST API key, if using Kakao |
| `KAKAO_CLIENT_SECRET` | Secret | Only if enabled in the Kakao console |

**Secret or Config?** Use **Secret** for anything that can impersonate you or reach a service:
secrets, keys, passwords, tokens, and the database URL. **Config** is for values that are public
anyway, like `NEXT_PUBLIC_APP_URL`. When in doubt, Secret — it hides the value after saving, and a
value you can no longer read is a value you can always rotate.

Note that the project URL is only known *after* the first deploy. If `NEXT_PUBLIC_APP_URL` is
missing on that first deploy, add it and redeploy.

### 4. Run the migrations

The app must not serve traffic before the schema exists. On Vercel this is GitHub Actions, so the
terminal is not involved.

1. **Repository → Settings → Secrets and variables → Actions → New repository secret**, add:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_APP_URL`
   - `VERCEL_TOKEN`
   - `VERCEL_DEPLOY_HOOK`
2. `VERCEL_TOKEN` comes from Vercel → **Account Settings → Tokens → Create**.
3. `VERCEL_DEPLOY_HOOK` comes from Vercel → **Project → Settings → Git → Deploy Hooks**. Create
   one pointing at `main` and copy the URL.
4. Open the **Actions** tab and run **Auto-migrate and deploy** (`workflow_dispatch`).
5. Watch it go green. The log ends with a successful call to the deploy hook, and a new deployment
   appears in Vercel within a minute.

The workflow is [`.github/workflows/deploy-migrate.yml`](../.github/workflows/deploy-migrate.yml).
It runs `prisma migrate deploy` — never `migrate dev`, which would try to create a migration and
prompt for a name in a non-interactive context.

### 5. Wire up the OAuth providers

Only needed if you want Google or Kakao sign-in. Full instructions in [`AUTH.md`](AUTH.md); the
short version:

**Google**

1. [Google Cloud Console](https://console.cloud.google.com/) → project.
2. **APIs & Services → OAuth consent screen** → configure, then publish or add yourself as a test
   user. Google requires 2-Step Verification on the owning account.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized redirect URI: `https://<your-project>.vercel.app/api/auth/callback/google`.
5. Copy the client ID and secret into the Vercel environment, then redeploy.

**Kakao**

1. [developers.kakao.com](https://developers.kakao.com/) → create an app.
2. Copy the **REST API key**.
3. **Kakao Login → Redirect URI** → add
   `https://<your-project>.vercel.app/api/auth/callback/kakao`.
4. **Kakao Login → Consent items** → tick **Kakao account email**.
5. Put the key in the Vercel environment, then redeploy.

### 6. Create the first admin

The Organiser tab needs a `User` row with `role = 'ADMIN'` and a bcrypt hash for the password.

Generate the hash locally:

```bash
npx -e "console.log(require('bcryptjs').hashSync('YourSecurePassword', 10))"
```

Then open the [Neon SQL Editor](https://console.neon.tech) and insert:

```sql
INSERT INTO "User" (id, email, name, studentId, department, role, "passwordHash", "isActive", "isDemo")
VALUES (
  gen_random_uuid()::text,
  'admin@helpingstation.deu',
  'Event Organiser',
  'ADMIN-001',
  'Administration',
  'ADMIN',
  '<paste the bcrypt hash here>',
  true,
  false
);
```

Then sign in on the Organiser tab. `isDemo` must be `false`, or the app treats the account as
rehearsal data.

## Verify the deployment

In order, because each step depends on the previous one:

1. `/` loads. A missing event shows "No event is open for registration", which is correct for an
   empty database and not an error.
2. `/login` → Student tab → the Google and Kakao buttons appear.
3. Sign in with Google using a `@deu.ac.kr` address. You land on `/account`.
4. `/admin` is reachable with the organiser account.
5. `/admin/settings` → the readiness panel is empty. Every line there is a real problem.

## The Vercel commit-author restriction

Read this if you see:

> The deployment was blocked because the commit author does not have contributing access to the
> project on Vercel. The Hobby Plan does not support collaboration for private repositories.

### What is actually happening

Vercel checks **who authored a commit**, not who pushed it. From [Vercel's own
documentation](https://vercel.com/docs/deployments/troubleshoot-project-collaboration):

> To deploy commits under a Hobby team, the commit author must be the owner of the Hobby team
> containing the Vercel project connected to the Git repository. This is verified by comparing the
> Login Connections Hobby team's owner with the commit author.

So a push is refused when the author e-mail on the head commit is not the e-mail of the person who
owns the Vercel team. Having push access to the repository is not enough, and the two accounts can
easily be different people — for instance when one person owns the GitHub repository and another
owns the Vercel project.

Check what your commits are stamped with:

```bash
git log --format="%an  %ae" -5
```

And what your identity is set to:

```bash
git config user.name
git config user.email
```

### The fix

Match the commit author to the Vercel team owner:

```bash
git config user.name  "the-github-username-of-the-vercel-owner"
git config user.email "the-verified-github-email-of-the-vercel-owner"
```

Then make a new commit so the head commit carries the corrected author, and push. Existing history
keeps its old author, which is fine — Vercel only inspects the commit being deployed.

Use `--global` to change it for every repository on the machine, or drop `--global` to change it
for this one only.

### The alternative, already wired here

[`deploy-migrate.yml`](../.github/workflows/deploy-migrate.yml) deploys through a **deploy hook**
rather than the Git integration, and a deploy hook is not subject to the author check. This
repository pushes on every commit to `main`, so migrations run and the deploy is triggered
regardless of who authored the commit.

That path works with two accounts and no configuration. It is the recommended route if the GitHub
repository and the Vercel project are owned by different people.

If you use it, Vercel's own Git integration will still attempt a deployment on every push and fail.
To stop the confusing red X in the Vercel dashboard, go to **Project → Settings → Git → Connected
Git Repository → Disconnect**. The deploy hook keeps working; only the automatic Git deploy stops.

---

## Mistakes worth not repeating

**Two workflows trying to deploy.** Only one should. This repository deploys through
`deploy-migrate.yml`, which applies migrations and then pings a Vercel deploy hook. A second
workflow that shells out to the Vercel CLI with a personal token fails with `Error: User not found`
unless that token is valid, and when it does work it simply races the first one. If you add a second
deploy path, make sure you meant to.

**`NEXT_PUBLIC_APP_URL` left at localhost.** QR codes, posters and share links all point at
`http://localhost:3000`. The readiness panel flags it, but nobody reads the readiness panel until
something is already broken.

**Deploying before migrating.** A route that queries a column the database does not have throws, and
the resulting 500 looks like an application bug rather than a deployment-ordering one.

**Adding an environment variable without redeploying.** Vercel applies variables at build and
runtime of a *deployment*. Editing the variable list does not touch the deployment that is already
serving. Redeploy, every time.

**Choosing Render's free PostgreSQL.** Free Render databases are deleted after 90 days without
inactivity. For a volunteer programme that expects to outlive a semester, that is a data-loss
deadline, not a free tier.

**Migrating into production with `migrate dev`.** It prompts for a migration name. Non-interactively
it either hangs or invents a name. Use `migrate deploy` in every automated path.

**Leaving a personal access token in a shell history or a remote URL.** If a token has been used in
a `git push https://user:token@github.com/...` command, treat it as compromised:
[revoke it](https://github.com/settings/tokens) and create a new one. GitHub cannot know it leaked,
and the token usually has repository write access.

## Other hosts

| Host | Config | Notes |
| --- | --- | --- |
| Render | [`render.yaml`](../render.yaml), [`DEPLOY.md`](../DEPLOY.md) | Blueprint creates the web service and the database together |
| Railway | [`railway.toml`](../railway.toml) | `railway up` from the repo root |
| Docker | [`Dockerfile`](../Dockerfile) | `output: "standalone"`, so no `node_modules` in the image |
| Vercel | [`vercel.json`](../vercel.json), [`VERCEL_DEPLOY.md`](../VERCEL_DEPLOY.md) | The live setup |

The app sets `output: "standalone"`, so a plain `next start` warns and you should run
`node .next/standalone/server.js` instead. The provided `Dockerfile` already does this.

## Cost

Zero, on every tier used here. The constraints to stay inside:

- Vercel Hobby: no commercial use, and no serverless functions above the hobby duration limit.
- Neon free: storage is capped, and the project is suspended after prolonged inactivity. A weekly
  visit to the console, or any real traffic, keeps it awake.

Neither limit is close for a university volunteer programme.
