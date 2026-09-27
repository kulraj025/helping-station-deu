# Vercel + Neon Deploy (5 min, Free Forever, No Card)

## Prerequisites (1 min)
1. **Neon account**: https://neon.tech → Sign up with GitHub
2. **Vercel account**: https://vercel.com → Sign up with GitHub

---

## Step 1: Create Neon PostgreSQL (1 min)
1. Go to https://console.neon.tech
2. **Create Project** → Name: `helping-station-deu`
3. Copy **Connection String** (looks like):
   ```
   postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/helpingstation?sslmode=require
   ```
4. Save this — you'll need it for Vercel

---

## Step 2: Deploy to Vercel (3 min)
1. Go to https://vercel.com/new
2. **Import Git Repository** → Select `kulraj025/helping-station-deu`
3. Vercel auto-detects Next.js → **Configure Project**
4. **Environment Variables** (add all):

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(paste Neon connection string)* |
| `AUTH_SECRET` | *(generate: `openssl rand -base64 32`)* |
| `NEXT_PUBLIC_APP_URL` | `https://helping-station-deu.vercel.app` |
| `DB_POOL_MAX` | `10` |
| `DEMO_MODE` | `false` |
| `APP_IS_PRODUCTION` | `true` |
| `CONTACT_EMAIL` | `helpingstation@deu.ac.kr` |
| `ORGANIZER_NAME` | `Helping Station DEU — Dong-Eui University` |

5. Click **Deploy** — builds in ~2 min
6. Live at `https://helping-station-deu.vercel.app`

---

## Step 3: Run Migrations (30 sec)
After first deploy:
```bash
# In your terminal
npx vercel env pull .env.local
npx prisma migrate deploy
```

Or use Vercel CLI:
```bash
npm i -g vercel
vercel login
vercel env pull
npx prisma migrate deploy
```

---

## Step 4: Seed Demo Data (optional)
```bash
npx tsx prisma/seed.ts
```

---

## Auto-Deploy on Push
1. In Vercel dashboard → Settings → Git
2. Enable **Auto-deploy on push to main**
3. Done — every `git push` deploys automatically

---

## Why Vercel + Neon?

| Feature | Vercel + Neon | Render |
|---------|---------------|--------|
| PostgreSQL free forever | ✅ | ⚠️ 90-day inactivity delete |
| Cold starts | ❌ None (edge) | ✅ 30s after 15min idle |
| Next.js optimization | ✅ Native | ✅ Docker |
| Custom domains | ✅ Free | ✅ Free |
| Preview deployments | ✅ Every PR | ❌ |
| No credit card | ✅ | ✅ |

---

## Troubleshooting

**Build fails with Prisma error:**
- Ensure `DATABASE_URL` is set in Vercel env vars
- Run `vercel env pull` locally and `npx prisma generate`

**Auth not working:**
- Check `AUTH_SECRET` is set (32+ chars)
- Verify `NEXT_PUBLIC_APP_URL` matches your Vercel URL exactly

**Database connection fails:**
- Neon requires `sslmode=require` in connection string
- Check Neon dashboard → Connection Details → Pooled connection
