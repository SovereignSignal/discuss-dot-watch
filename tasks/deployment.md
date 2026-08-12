# discuss.watch - Deployment Guide

> Instructions for deploying to Railway

## Prerequisites

1. **Railway Account** - https://railway.app
2. **GitHub Repository** - Connected to Railway for auto-deploy

---

## Environment Variables

### Required for Full Functionality

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `DATABASE_URL` | Postgres connection string | Railway → Add Postgres → Variables |
| `REDIS_URL` | Redis connection string for forum cache | Railway → Add Redis → Variables |
| `ANTHROPIC_API_KEY` | Claude API key for AI digests | console.anthropic.com |
| `RESEND_API_KEY` | Email delivery API key | resend.com |
| `RESEND_FROM_EMAIL` | Sender address for digests | Resend verified domain |
| `CRON_SECRET` | Bearer token for cron and admin endpoints | Generate with `openssl rand -hex 32` |
| `ADMIN_SECRET` | Optional admin Bearer token (same privileges as CRON_SECRET) | Generate with `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | AES-256-GCM key for delegate API keys | Generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Public app URL (digest email links) | `https://discuss.watch` |

### Optional

- `GITHUB_TOKEN` — Higher rate limits on GitHub Discussions
- `SNAPSHOT_API_KEY` — Higher rate limits on Snapshot GraphQL

### Without optional infra

- Without `REDIS_URL`: in-memory cache only (works for single-instance local dev; production prefers Redis)
- Without `DATABASE_URL`: persistence and analytics degrade; the public feed still works from cache

---

## Step-by-Step Deployment

### 1. Set Up Railway Project

```bash
# Already done - project exists at:
# https://discuss.watch/
```

### 2. Add Postgres Database

1. In Railway dashboard, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Wait for provisioning (~30 seconds)
3. Click the Postgres service → **"Variables"** tab
4. Copy `DATABASE_URL`
5. Go to your main service → **"Variables"** tab
6. Add `DATABASE_URL` with the copied value

### 3. Database Schema

**No manual step needed.** Schema initializes lazily on the first API request via `initializeSchema()` in `src/lib/db.ts` and `initializeDelegateSchema()` in `src/lib/delegates/db.ts`. Both use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` so they are idempotent and forward-compatible.

If you want to inspect or seed the schema manually:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Connect to your project
railway link

# Run psql with schema
railway run psql -f src/lib/schema.sql
```

### 4. Trigger Redeploy

Railway auto-deploys on push, but to pick up new env vars:

1. Go to **Deployments** tab
2. Click **"Redeploy"** on latest deployment

Or push any change:
```bash
git commit --allow-empty -m "Trigger redeploy" && git push
```

---

## Verifying Deployment

### Check Build Logs

1. Railway Dashboard → Deployments → Click latest
2. Look for:
   - ✅ `npm ci` completed
   - ✅ `npm run build` completed
   - ✅ No TypeScript errors

### Check Application

1. Visit https://discuss.watch/
2. Verify:
   - [ ] Landing page loads
   - [ ] "Open App" goes to `/app` with no login wall
   - [ ] Discussions load from forums (All Forums tab)

### Check Database Connection

1. Confirm `DATABASE_URL` is set
2. Hit `/api/health` and confirm `database` is `ok` when Postgres is configured
3. Check Railway Postgres → Data → Tables for `forums` / `topics` after a cache refresh

---

## Troubleshooting

### Build Fails: package-lock.json out of sync

```bash
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json"
git push
```

### Build Fails: Node version

Check `nixpacks.toml` specifies correct Node:
```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["npm i -g npm@11", "npm ci"]
```

### Database Connection Errors

1. Verify `DATABASE_URL` is set in Railway variables
2. Check Postgres service is running
3. Verify schema was run (tables exist)

### Admin Panel Unauthorized

1. Confirm `ADMIN_SECRET` or `CRON_SECRET` is set
2. Enter that value on `/admin`
3. Check browser console for errors

---

## Local Development

```bash
# Clone repo
git clone https://github.com/SovereignSignal/discuss-dot-watch.git
cd discuss-dot-watch

# Install dependencies
npm install

# Copy env example
cp .env.example .env.local

# Edit .env.local with your values
# (Optional - app works without them)

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## Monitoring

### Railway Logs

```bash
# Via CLI
railway logs

# Or in dashboard
Railway → Your Service → Logs tab
```

### Key Metrics to Watch

- Build time (should be < 2 minutes)
- Memory usage (check Metrics tab)
- API response times (check Observability)

---

## Rollback

If a deployment breaks:

1. Railway Dashboard → Deployments
2. Find last working deployment
3. Click **"..."** → **"Rollback"**

Or revert in git:
```bash
git revert HEAD
git push
```
