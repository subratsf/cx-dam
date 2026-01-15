# Quick Deploy to Heroku

## 🚀 Fast Track Deployment

### 1. Install Heroku CLI
```bash
# macOS
brew tap heroku/brew && brew install heroku

# Or download from: https://devcenter.heroku.com/articles/heroku-cli
```

### 2. Login and Create App
```bash
heroku login
heroku create your-app-name
```

### 3. Add Database
```bash
heroku addons:create heroku-postgresql:essential-0
```

### 4. Set Environment Variables
```bash
# Copy this and replace YOUR_VALUES
heroku config:set \
  GITHUB_CLIENT_ID=YOUR_GITHUB_CLIENT_ID \
  GITHUB_CLIENT_SECRET=YOUR_GITHUB_CLIENT_SECRET \
  GITHUB_CALLBACK_URL=https://your-app-name.herokuapp.com/api/auth/github/callback \
  GITHUB_ORG=YOUR_GITHUB_ORG \
  AWS_REGION=ap-south-1 \
  AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY \
  AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET \
  S3_BUCKET_NAME=YOUR_BUCKET \
  CLOUDFRONT_STAGE_URL=https://your-stage.cloudfront.net \
  CLOUDFRONT_PROD_URL=https://your-prod.cloudfront.net \
  JWT_SECRET=$(openssl rand -hex 32) \
  JWT_EXPIRY=7d \
  API_BASE_URL=https://your-app-name.herokuapp.com \
  FRONTEND_URL=https://your-app-name.herokuapp.com \
  NODE_ENV=production
```

### 5. Deploy
```bash
git push heroku main
```

### 6. Run Migrations
```bash
heroku run "cd apps/backend && npm run migrate"
```

### 7. Open App
```bash
heroku open
```

## 📊 Monitor
```bash
# View logs
heroku logs --tail

# Check status
heroku ps
```

## 🔄 Update GitHub OAuth
Go to https://github.com/settings/developers and update:
- **Homepage URL**: https://your-app-name.herokuapp.com
- **Callback URL**: https://your-app-name.herokuapp.com/api/auth/github/callback

---

**Done!** For detailed instructions, see [HEROKU_DEPLOYMENT.md](./HEROKU_DEPLOYMENT.md)
