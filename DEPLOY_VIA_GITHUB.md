# Deploy to Heroku via GitHub (Easiest Method)

Since git push is having authentication issues, use GitHub integration instead. This is actually the **recommended** method for production deployments.

## Steps

### 1. Push Your Code to GitHub

```bash
# Make sure all changes are committed
git add .
git commit -m "Prepare for Heroku deployment"

# Push to GitHub
git push origin main
```

### 2. Connect Heroku to GitHub

1. Go to Heroku Dashboard: https://dashboard.heroku.com/apps/cx-dam
2. Click on the **Deploy** tab
3. Under **Deployment method**, click **GitHub**
4. Click **Connect to GitHub** button
5. Authorize Heroku if prompted
6. Search for repository: `cx-dam` or `sfdocs/cx-dam`
7. Click **Connect** next to your repository

### 3. Deploy

**Option A: Manual Deploy (First Time)**
1. Scroll to **Manual deploy** section
2. Select branch: `main`
3. Click **Deploy Branch**
4. Wait for build to complete (5-10 minutes)

**Option B: Enable Automatic Deploys**
1. Scroll to **Automatic deploys** section
2. Select branch: `main`
3. Check "Wait for CI to pass before deploy" (optional)
4. Click **Enable Automatic Deploys**
5. Click **Deploy Branch** for first deployment

### 4. Monitor Deployment

Watch the build logs in real-time:
- In the Heroku dashboard, you'll see build progress
- Or use CLI: `heroku logs --tail --app cx-dam`

### 5. Run Migrations After Deploy

```bash
heroku run "cd apps/backend && npm run migrate" --app cx-dam
```

### 6. Open Your App

```bash
heroku open --app cx-dam
```

## Advantages of GitHub Integration

✅ **No Git authentication issues**
✅ **Automatic deploys on every push**
✅ **Build logs in dashboard**
✅ **Easy rollback to previous versions**
✅ **Review apps for pull requests (can be enabled)**
✅ **CI/CD integration**

## Troubleshooting

### Build Fails

Check build logs in Heroku Dashboard or:
```bash
heroku logs --tail --app cx-dam
```

### Need to Trigger Manual Deploy

```bash
# Using Heroku CLI
heroku builds:create --source-tar <(git archive --format=tar.gz HEAD) --app cx-dam
```

### Disconnect and Reconnect GitHub

1. Go to Deploy tab
2. Click **Disconnect** under GitHub section
3. Follow connection steps again

## Environment Variables

Make sure all required environment variables are set:

```bash
# Check what's set
heroku config --app cx-dam

# Set missing variables
heroku config:set VARIABLE_NAME=value --app cx-dam
```

## Future Deployments

Once GitHub integration is set up:

1. **Make changes** to your code
2. **Commit**: `git commit -am "Your changes"`
3. **Push to GitHub**: `git push origin main`
4. **Heroku automatically deploys** (if automatic deploys enabled)

That's it! No more git push issues! 🎉

---

## Quick Setup Commands

```bash
# 1. Commit and push to GitHub
git add .
git commit -m "Ready for Heroku deployment"
git push origin main

# 2. Go to: https://dashboard.heroku.com/apps/cx-dam/deploy/github
# 3. Connect GitHub and deploy

# 4. After deploy, run migrations
heroku run "cd apps/backend && npm run migrate" --app cx-dam

# 5. Open app
heroku open --app cx-dam
```
