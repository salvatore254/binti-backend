# Netlify Migration Guide

## Overview

Your backend has been prepared for migration from Railway to Netlify Functions. This document explains the setup and how to deploy.

## What Changed

### Directory Structure
```
backend/
├── netlify/
│   └── functions/          # Serverless functions
│       ├── utils.js         # Shared utilities (CORS, error handling)
│       ├── bookings-calculate.js
│       └── health.js
├── netlify.toml            # Netlify configuration
├── package.json            # Updated scripts
└── (existing files)        # Express server still available for local development
```

### Key Files

1. **netlify/functions/utils.js**
   - Shared CORS handling for all functions
   - Error handling wrapper
   - Body parsing utilities

2. **netlify/functions/bookings-calculate.js**
   - Converted from Express POST /api/bookings/calculate
   - Handles tent selection pricing
   - Transport cost calculation

3. **netlify/functions/health.js**
   - Health check endpoint
   - Returns status and timestamp

4. **netlify.toml**
   - Netlify configuration
   - Function routing
   - CORS headers configuration
   - Redirects setup

## How to Test Locally

### Option 1: Test with Netlify CLI (Recommended)

```bash
# Install Netlify CLI globally if not already
npm install -g netlify-cli

# From your backend directory
cd backend

# Start Netlify dev server (includes functions)
npm run netlify:dev
```

Then test:
```bash
# OPTIONS preflight
curl -X OPTIONS http://localhost:8888/api/bookings/calculate -i

# POST calculation
curl -X POST http://localhost:8888/api/bookings/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "bookingFlow": "tent",
    "tentConfigs": [{"type": "cheese"}],
    "lighting": "no",
    "transport": "yes",
    "location": "westlands"
  }'
```

### Option 2: Keep Using Express Locally

Local development continues to work the same way:
```bash
npm run dev
```

The Express server will work as before for development.

## Deployment to Netlify

### Step 1: Connect Repository to Netlify

1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Select your GitHub repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Functions directory**: `netlify/functions`
   - **Publish directory**: `netlify/functions`

### Step 2: Set Environment Variables

In Netlify Dashboard → Site settings → Environment → Environment variables:

```
NODE_ENV = production
DB_HOST = your-mongodb-host
DB_PORT = your-mongodb-port
DB_NAME = your-db-name
DB_USER = your-db-user
DB_PASSWORD = your-db-password
EMAIL_USER = your-email
EMAIL_PASS = your-email-password
```

### Step 3: Deploy

```bash
# Option A: Direct push to main branch (auto-deploys if connected to Netlify)
git push origin main

# Option B: Manual deployment via Netlify CLI
netlify deploy --prod
```

## API Endpoints

After migration, your endpoints will be:

```
https://your-site.netlify.app/api/bookings/calculate
https://your-site.netlify.app/api/health
```

Update your frontend API URLs to use the new domain.

## Frontend Configuration

Update your frontend API calls:

**Before (Railway):**
```javascript
const API_URL = 'https://binti-backend-production.up.railway.app/api';
```

**After (Netlify):**
```javascript
const API_URL = 'https://your-site.netlify.app/api';
```

## Important Notes

### CORS
- Netlify handles CORS at the edge with our headers configuration
- All origins allowed by default (can be restricted in netlify.toml if needed)
- Preflight requests (OPTIONS) handled automatically

### Database Connection
- MongoDB Atlas should remain the same
- Ensure IP whitelist includes Netlify's infrastructure
- Netlify outbound IPs: https://docs.netlify.com/functions/overview/#ip-addresses

### Cold Starts
- First request may take longer (Netlify Function warm-up)
- This is normal and only happens occasionally
- Subsequent requests are fast

### Limits
- **Free tier**: 300 minutes/month of function runtime
- **Pro tier**: Unlimited minutes
- Monitor function runtime in Netlify dashboard

## Rollback Plan

If issues occur, you can:

1. **Keep Railway running** (don't delete)
2. **Switch frontend back to Railway URL** if needed
3. **Fix issues and redeploy to Netlify**

## Monitoring

After deployment, monitor in Netlify Dashboard:
- **Functions** tab: View logs, see invocations, track errors
- **Deploys** tab: See deploy history and logs
- **Site overview** tab: Overall site health

## Next Steps

1. ✅ Local testing with `npm run netlify:dev`
2. ✅ Create Netlify account and connect repository
3. ✅ Set environment variables
4. ✅ Deploy and test in production
5. ✅ Update frontend with new API URL
6. ✅ Monitor logs for any issues

## Troubleshooting

### Functions not found
- Check `netlify.toml` function configuration
- Ensure functions directory path is correct
- Rebuild with `netlify deploy`

### CORS still failing
- Check Netlify headers configuration in `netlify.toml`
- Verify function returns proper headers
- Check browser DevTools Network tab

### Database connection timeout
- Verify MongoDB IP whitelist includes Netlify
- Check credentials in environment variables
- Monitor database for connection issues

## Support

For issues with Netlify deployment:
- Check Netlify Functions docs: https://docs.netlify.com/functions/overview/
- Review function logs in Netlify dashboard
- Check error logs: Dashboard → Logs → Function logs

---

**Status**: Ready for Netlify deployment ✅
**Current**: Railway (fully functional)
**Next**: Netlify (prepared, awaiting deployment)
