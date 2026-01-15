# Heroku Deployment Guide for CX-DAM

This guide walks you through deploying the CX-DAM (Digital Asset Management) application to Heroku.

## Prerequisites

1. **Heroku Account**: Sign up at [heroku.com](https://heroku.com)
2. **Heroku CLI**: Install from [devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
3. **Git**: Ensure your code is in a Git repository
4. **AWS Account**: For S3 bucket and CloudFront distribution
5. **GitHub OAuth App**: For authentication

## Architecture Overview

The application consists of:
- **Backend**: Node.js/Express API (runs on Heroku)
- **Frontend**: React SPA (built and served as static files from backend)
- **Database**: PostgreSQL (Heroku Postgres addon)
- **Storage**: AWS S3 + CloudFront CDN
- **Auth**: GitHub OAuth

## Step 1: Heroku CLI Login

```bash
heroku login
```

## Step 2: Create Heroku Application

```bash
# Create app (Heroku will assign a random name if you don't provide one)
heroku create cx-dam-app

# Or let Heroku generate a name
heroku create

# Note: Your app will be available at: https://your-app-name.herokuapp.com
```

## Step 3: Add PostgreSQL Database

```bash
# Add Heroku Postgres (Essential plan or higher for production)
heroku addons:create heroku-postgresql:essential-0

# Verify database was created
heroku addons:info heroku-postgresql

# Get database URL (automatically set as DATABASE_URL)
heroku config:get DATABASE_URL
```

## Step 4: Configure Environment Variables

Set all required environment variables:

```bash
# GitHub OAuth (create at: https://github.com/settings/developers)
heroku config:set GITHUB_CLIENT_ID=your_client_id
heroku config:set GITHUB_CLIENT_SECRET=your_client_secret
heroku config:set GITHUB_CALLBACK_URL=https://your-app-name.herokuapp.com/api/auth/github/callback
heroku config:set GITHUB_ORG=your-github-org

# AWS S3 Configuration
heroku config:set AWS_REGION=ap-south-1
heroku config:set AWS_ACCESS_KEY_ID=your_access_key
heroku config:set AWS_SECRET_ACCESS_KEY=your_secret_key
heroku config:set AWS_SESSION_TOKEN=your_session_token  # If using temporary credentials
heroku config:set S3_BUCKET_NAME=your-bucket-name

# CloudFront URLs
heroku config:set CLOUDFRONT_STAGE_URL=https://your-stage-cloudfront-url.cloudfront.net
heroku config:set CLOUDFRONT_PROD_URL=https://your-prod-cloudfront-url.cloudfront.net

# JWT Secret (generate a secure random string)
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set JWT_EXPIRY=7d

# API Configuration
heroku config:set API_PORT=3001
heroku config:set API_BASE_URL=https://your-app-name.herokuapp.com
heroku config:set FRONTEND_URL=https://your-app-name.herokuapp.com

# Node Environment
heroku config:set NODE_ENV=production

# Verify all config vars
heroku config
```

## Step 5: Update GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Select your OAuth App
3. Update **Authorization callback URL** to:
   ```
   https://your-app-name.herokuapp.com/api/auth/github/callback
   ```
4. Update **Homepage URL** to:
   ```
   https://your-app-name.herokuapp.com
   ```

## Step 6: Update Backend Configuration

Ensure your backend serves the frontend static files. Check `apps/backend/src/index.ts`:

```typescript
// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendPath));

  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}
```

## Step 7: Configure Frontend API URL

Update `apps/frontend/src/api/client.ts` to use relative URLs in production:

```typescript
const baseURL = import.meta.env.PROD
  ? '/api'  // Relative URL in production
  : 'http://localhost:3001/api';  // Local backend in dev
```

## Step 8: Deploy to Heroku

```bash
# Add remote (if not already added)
git remote add heroku https://git.heroku.com/your-app-name.git

# Deploy
git push heroku main

# Or if your branch is named differently
git push heroku your-branch-name:main
```

Heroku will automatically:
1. Install dependencies (`npm install`)
2. Run `heroku-postbuild` script (builds backend + frontend)
3. Start the app using the `Procfile`

## Step 9: Run Database Migrations

```bash
# Connect to Heroku bash
heroku run bash

# Once inside the Heroku dyno
cd apps/backend
npm run migrate

# Exit
exit
```

Or run migrations directly:
```bash
heroku run "cd apps/backend && npm run migrate"
```

## Step 10: Verify Deployment

```bash
# Check logs
heroku logs --tail

# Open app in browser
heroku open

# Check app status
heroku ps
```

## Step 11: Scale Dynos (Optional)

```bash
# Scale to 1 dyno (free tier)
heroku ps:scale web=1

# For production, scale up
heroku ps:scale web=2
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Heroku Postgres |
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | `Ov23li6Yd6oBwbqrHqQy` |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Secret | `8015ba107a40ee...` |
| `GITHUB_CALLBACK_URL` | OAuth callback URL | `https://app.herokuapp.com/api/auth/github/callback` |
| `GITHUB_ORG` | GitHub organization name | `salesforcedocs` |
| `AWS_REGION` | AWS region | `ap-south-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | `ASIAVZPT...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | `svkZCXVP...` |
| `S3_BUCKET_NAME` | S3 bucket name | `dam-hack` |
| `CLOUDFRONT_STAGE_URL` | CloudFront stage URL | `https://d37m7o...cloudfront.net` |
| `CLOUDFRONT_PROD_URL` | CloudFront prod URL | `https://desg6k...cloudfront.net` |
| `JWT_SECRET` | JWT signing secret | Random 32+ char string |
| `JWT_EXPIRY` | JWT token expiry | `7d` |
| `NODE_ENV` | Node environment | `production` |
| `API_PORT` | API port (Heroku sets this) | Auto-set by Heroku |

## Continuous Deployment (Optional)

### Option 1: GitHub Integration

1. Go to Heroku Dashboard → Your App → Deploy
2. Connect to GitHub
3. Enable automatic deploys from main branch
4. Every push to main will trigger a deployment

### Option 2: Heroku CI/CD

```bash
# Enable Heroku CI
heroku ci:enable

# Configure test command in app.json
```

## Monitoring and Logs

```bash
# View logs
heroku logs --tail

# View logs for specific dyno
heroku logs --dyno web.1 --tail

# View metrics
heroku metrics

# Check app health
curl https://your-app-name.herokuapp.com/api/health
```

## Troubleshooting

### 1. Build Fails

```bash
# Check build logs
heroku logs --tail

# Ensure dependencies are in dependencies (not devDependencies)
# Heroku doesn't install devDependencies in production
```

### 2. Application Crashes

```bash
# Check error logs
heroku logs --tail

# Restart dynos
heroku restart

# Check dyno status
heroku ps
```

### 3. Database Connection Issues

```bash
# Verify DATABASE_URL is set
heroku config:get DATABASE_URL

# Test database connection
heroku run "cd apps/backend && node -e \"console.log('Testing DB')\" "
```

### 4. Frontend Not Loading

- Ensure frontend build output is in `apps/frontend/dist`
- Check backend serves static files correctly
- Verify API routes are prefixed with `/api`

### 5. CORS Issues

- Ensure `FRONTEND_URL` config var is set correctly
- Check CORS configuration in backend allows Heroku domain

## Performance Optimization

### 1. Enable Compression

Backend should use compression middleware (already included):
```typescript
import compression from 'compression';
app.use(compression());
```

### 2. Use CDN for Static Assets

- Frontend assets are served from CloudFront
- S3 handles file storage
- This reduces load on Heroku dynos

### 3. Database Connection Pooling

Ensure your database uses connection pooling:
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20, // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 4. Enable HTTP/2

Heroku automatically enables HTTP/2 for HTTPS requests.

## Cost Estimation

### Free Tier
- 1 web dyno: Free (550-1000 hours/month)
- Heroku Postgres (Hobby Dev): Free (10,000 rows limit)
- **Total**: $0/month

### Production Tier
- 2 web dynos (Hobby): $14/month ($7 each)
- Heroku Postgres (Essential-0): $5/month (10M rows, 64GB storage)
- **Total**: ~$19/month

## Backup and Recovery

```bash
# Manual backup
heroku pg:backups:capture

# Schedule automatic backups (requires paid plan)
heroku pg:backups:schedule DATABASE_URL --at '02:00 America/Los_Angeles'

# List backups
heroku pg:backups

# Restore from backup
heroku pg:backups:restore b101 DATABASE_URL
```

## Security Checklist

- ✅ Use HTTPS (enforced by Heroku)
- ✅ Set secure JWT secret
- ✅ Enable Heroku SSL
- ✅ Use environment variables (never commit secrets)
- ✅ Configure CORS properly
- ✅ Use helmet.js for security headers
- ✅ Enable rate limiting
- ✅ Use parameterized queries (prevent SQL injection)
- ✅ Validate all inputs with Zod schemas

## Support and Resources

- **Heroku Docs**: https://devcenter.heroku.com/
- **Heroku Postgres**: https://devcenter.heroku.com/articles/heroku-postgresql
- **Buildpacks**: https://devcenter.heroku.com/articles/buildpacks
- **Heroku CLI**: https://devcenter.heroku.com/articles/heroku-cli

## Rollback

If deployment fails:

```bash
# View releases
heroku releases

# Rollback to previous version
heroku rollback v42
```

---

## Quick Deploy Commands Summary

```bash
# 1. Create app
heroku create your-app-name

# 2. Add database
heroku addons:create heroku-postgresql:essential-0

# 3. Set environment variables (see Step 4)
heroku config:set KEY=value

# 4. Deploy
git push heroku main

# 5. Run migrations
heroku run "cd apps/backend && npm run migrate"

# 6. Open app
heroku open
```

---

**Deployment Complete!** 🎉

Your CX-DAM application should now be live at `https://your-app-name.herokuapp.com`
