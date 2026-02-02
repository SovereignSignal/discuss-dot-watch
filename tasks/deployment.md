# Gov Watch - Deployment Guide

> Instructions for deploying to Railway

## Prerequisites

1. **Railway Account** - https://railway.app
2. **Privy Account** - https://dashboard.privy.io (for authentication)
3. **GitHub Repository** - Connected to Railway for auto-deploy

---

## Environment Variables

### Required for Full Functionality

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app identifier | Privy Dashboard → Settings |
| `DATABASE_URL` | Postgres connection string | Railway → Add Postgres → Variables |

### Optional

The app works without these variables (localStorage-only mode):
- Without `NEXT_PUBLIC_PRIVY_APP_ID`: No login button shown, anonymous mode only
- Without `DATABASE_URL`: API user routes return 503, localStorage used

---

## Step-by-Step Deployment

### 1. Set Up Railway Project

```bash
# Already done - project exists at:
# https://gov-forum-watcher-production.up.railway.app/
```

### 2. Add Postgres Database

1. In Railway dashboard, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Wait for provisioning (~30 seconds)
3. Click the Postgres service → **"Variables"** tab
4. Copy `DATABASE_URL`
5. Go to your main service → **"Variables"** tab
6. Add `DATABASE_URL` with the copied value

### 3. Run Database Schema

1. In Railway, click Postgres service → **"Data"** tab
2. Open **"Query"** panel
3. Copy contents of `src/lib/schema.sql`
4. Paste and run the SQL

Or use CLI:
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

### 4. Set Up Privy

1. Go to https://dashboard.privy.io
2. Create new app (or use existing)
3. **Settings** → Copy **App ID**
4. **Allowed Origins** → Add:
   - `https://gov-forum-watcher-production.up.railway.app`
   - `http://localhost:3000` (for local dev)
5. In Railway, add variable:
   - `NEXT_PUBLIC_PRIVY_APP_ID` = your app ID

#### Enabling Google Login

Google OAuth requires additional configuration in Privy:

1. In Privy Dashboard, go to **Login Methods**
2. Enable **Google** toggle
3. Privy uses their own Google OAuth credentials by default
4. If you see issues:
   - Verify your domain is in **Allowed Origins**
   - Check that the Railway URL exactly matches (including https://)
   - Note: Google OAuth may not work in localhost without custom setup

### 5. Trigger Redeploy

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

1. Visit https://gov-forum-watcher-production.up.railway.app/
2. Verify:
   - [ ] Landing page loads
   - [ ] "Launch App" button works
   - [ ] Discussions load from forums
   - [ ] Login button appears (if Privy configured)

### Check Database Connection

1. Click "Sign In" in app
2. Create account
3. Add a forum
4. Check Railway Postgres → Data → Tables
5. Verify `users` and `user_forums` have entries

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
nixPkgs = ["nodejs_22", "npm"]
```

### Database Connection Errors

1. Verify `DATABASE_URL` is set in Railway variables
2. Check Postgres service is running
3. Verify schema was run (tables exist)

### Privy Login Not Working

1. Verify `NEXT_PUBLIC_PRIVY_APP_ID` is set
2. Check Privy dashboard → Allowed Origins includes your Railway URL
3. Check browser console for errors

---

## Local Development

```bash
# Clone repo
git clone https://github.com/SovereignSignal/gov-forum-watcher.git
cd gov-forum-watcher

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
