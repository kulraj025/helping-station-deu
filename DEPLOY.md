# Helping Station DEU — Deployment Guide

This is a Next.js 15 application with Prisma + PostgreSQL. It requires a PostgreSQL database and Node.js 20+.

## Quick Deploy Options

### 1. Render (Recommended — Free PostgreSQL + Free Web Service)

1. Go to [render.com](https://render.com) → Sign up with GitHub
2. **New +** → **Blueprint** → Connect `kulraj025/helping-station-deu`
3. Render reads `render.yaml` and creates:
   - PostgreSQL database (free tier)
   - Web service (free tier, Docker)
4. Click **Apply** — deploys in ~5 min
5. Live at `https://helping-station-deu.onrender.com`

**Required env vars** (auto-set by Blueprint):
- `DATABASE_URL` → from the created PostgreSQL
- `AUTH_SECRET` → auto-generated
- `NEXT_PUBLIC_APP_URL` → your Render URL

---

### 2. Railway

```bash
# One-time
npm i -g @railway/cli
railway login

# Deploy
railway init --name helping-station-deu
railway add postgresql
railway up
```

Or via dashboard: railway.app → New Project → Deploy from GitHub → Select repo

**Add env vars in Railway dashboard:**
- `DATABASE_URL` → from Railway PostgreSQL
- `AUTH_SECRET` → generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- `NEXT_PUBLIC_APP_URL` → your Railway URL
- `DB_POOL_MAX=10`
- `DEMO_MODE=false`
- `APP_IS_PRODUCTION=true`

---

### 3. Vercel (Best for Next.js) + External PostgreSQL

1. Provision PostgreSQL: [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app)
2. Go to [vercel.com](https://vercel.com) → Import Git Repository
3. Add env vars in Vercel dashboard:
   - `DATABASE_URL` → from your PostgreSQL provider
   - `AUTH_SECRET` → generate: `openssl rand -base64 32`
   - `NEXT_PUBLIC_APP_URL` → your Vercel URL
   - `DB_POOL_MAX=10`
   - `DEMO_MODE=false`
   - `APP_IS_PRODUCTION=true`
4. Deploy — Vercel auto-detects Next.js

---

### 4. Docker (Any VPS / Cloud Run / Fly.io)

```bash
# Build
docker build -t helping-station-deu .

# Run (needs PostgreSQL)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e AUTH_SECRET="..." \
  -e NEXT_PUBLIC_APP_URL="https://your-domain.com" \
  -e DB_POOL_MAX=10 \
  -e DEMO_MODE=false \
  -e APP_IS_PRODUCTION=true \
  helping-station-deu
```

**Google Cloud Run:**
```bash
gcloud run deploy helping-station-deu \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="DATABASE_URL=...,AUTH_SECRET=...,NEXT_PUBLIC_APP_URL=...,DB_POOL_MAX=10,DEMO_MODE=false,APP_IS_PRODUCTION=true"
```

**Fly.io:**
```bash
flyctl launch --name helping-station-deu --dockerfile Dockerfile
flyctl secrets set DATABASE_URL=... AUTH_SECRET=... NEXT_PUBLIC_APP_URL=... DB_POOL_MAX=10 DEMO_MODE=false APP_IS_PRODUCTION=true
flyctl deploy
```

---

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | 32-byte base64 (generate with `openssl rand -base64 32`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Absolute URL (e.g., `https://helping-station-deu.onrender.com`) |
| `DB_POOL_MAX` | ❌ | `10` (or `1` for PGlite) |
| `DEMO_MODE` | ❌ | `false` in production |
| `APP_IS_PRODUCTION` | ❌ | `true` in production |
| `CONTACT_EMAIL` | ❌ | Contact email for footer |
| `ORGANIZER_NAME` | ❌ | Organization name |
| `DATA_RETENTION_DAYS` | ❌ | `180` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ❌ | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | ❌ | Cloudflare Turnstile secret key |
| `UPSTASH_REDIS_REST_URL` | ❌ | For distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | For distributed rate limiting |

---

## Post-Deploy Checklist

After deploying:

1. **Run migrations:**
   ```bash
   # Render/Railway: runs automatically via build command
   # Vercel/Docker: run manually
   npx prisma migrate deploy
   ```

2. **Seed demo data (optional):**
   ```bash
   npx tsx prisma/seed.ts
   ```

3. **Verify health:** `https://your-url/api/health`

4. **Check `/admin/settings`** — shows readiness panel with any issues

5. **Update `NEXT_PUBLIC_APP_URL`** if it changed

---

## Local Development

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your values

# Option A: Real PostgreSQL
npm run db:migrate
npm run db:seed

# Option B: Bundled PGlite (no install needed)
npm run db:dev          # Terminal 1 - starts DB on :5433
# In .env, set DB_POOL_MAX=1
npm run dev             # Terminal 2

# Run
npm run dev
```

Open http://localhost:3000

---

## Database Migrations in Production

**Render/Railway:** Add to build command:
```bash
npm run build && npx prisma migrate deploy
```

**Vercel:** Run locally or via GitHub Action:
```bash
npx prisma migrate deploy
```

**Docker:** Add to Dockerfile or run as one-off job.

---

## Health Check

All deployments should use `/api/health` (returns 200 OK).

---

## Custom Domain

After deploying, add custom domain in platform dashboard:
- Render: Settings → Custom Domains
- Railway: Settings → Domains
- Vercel: Settings → Domains
- Cloud Run: Domain Mapping
