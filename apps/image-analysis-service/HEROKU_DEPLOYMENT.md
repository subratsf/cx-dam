# 🚀 Heroku Deployment Guide

This guide explains how to deploy the Python image analysis service to Heroku.

## 📋 Prerequisites

1. **Heroku Account**: Sign up at https://heroku.com
2. **Heroku CLI**: Install from https://devcenter.heroku.com/articles/heroku-cli
3. **OpenAI API Key**: Get from https://platform.openai.com/api-keys
4. **Qdrant Cloud Account**: Sign up at https://cloud.qdrant.io (free tier available)

## 🔧 Setup Steps

### Step 1: Create Qdrant Cloud Cluster

1. Go to https://cloud.qdrant.io and create a free account
2. Create a new cluster (free tier provides 1GB storage)
3. Note down:
   - **Cluster URL** (e.g., `https://xxx-xxx.qdrant.io`)
   - **API Key** (from cluster settings)

### Step 2: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Note it down (you won't see it again)

**Cost Estimate**: Using `gpt-4o-mini` for image descriptions:
- ~$0.15 per 1000 images analyzed
- Much cheaper than running your own GPU server

### Step 3: Create Heroku App

```bash
# Navigate to the service directory
cd apps/image-analysis-service

# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-app-name-image-analysis

# Or if you have an existing app
heroku git:remote -a your-existing-app-name
```

### Step 4: Configure Environment Variables

Set the required environment variables on Heroku:

```bash
# Image description provider (use OpenAI for Heroku)
heroku config:set IMAGE_DESCRIPTION_PROVIDER=openai

# OpenAI API key
heroku config:set OPENAI_API_KEY=your-openai-api-key-here

# OpenAI model (gpt-4o-mini is fast and cheap)
heroku config:set OPENAI_VISION_MODEL=gpt-4o-mini

# Qdrant Cloud settings
heroku config:set QDRANT_URL=https://your-cluster.qdrant.io
heroku config:set QDRANT_API_KEY=your-qdrant-api-key

# Content moderation threshold (0.6 = 60% confidence)
heroku config:set CONTENT_MODERATION_THRESHOLD=0.6
```

### Step 5: Deploy to Heroku

```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial Heroku deployment"

# Push to Heroku
git push heroku main

# Or if you're on a different branch
git push heroku your-branch:main
```

### Step 6: Scale the Dyno

```bash
# Start the web dyno
heroku ps:scale web=1

# Check dyno status
heroku ps
```

### Step 7: Verify Deployment

```bash
# Check logs
heroku logs --tail

# Test health endpoint
curl https://your-app-name-image-analysis.herokuapp.com/health

# Expected response:
# {
#   "status": "healthy",
#   "services": {
#     "content_moderation": "ready",
#     "image_description": "ready",
#     "vector_search": "ready"
#   }
# }
```

### Step 8: Update Backend Configuration

Update your Express backend's `.env` file:

```bash
# For Heroku deployment
IMAGE_ANALYSIS_SERVICE_URL=https://your-app-name-image-analysis.herokuapp.com
```

Redeploy your backend with the updated configuration.

## 📊 Monitoring

### View Logs

```bash
# Live logs
heroku logs --tail

# Recent logs
heroku logs --tail -n 500
```

### Check Dyno Status

```bash
heroku ps
```

### View Config Variables

```bash
heroku config
```

## 💰 Cost Breakdown

### Heroku Costs
- **Eco Dyno**: $5/month (or free with student pack)
- **Basic Dyno**: $7/month (no sleep, better performance)

### OpenAI Costs (gpt-4o-mini)
- **Input**: $0.150 per 1M tokens (~$0.15 per 1000 images)
- **Output**: $0.600 per 1M tokens
- Typical cost: **$0.20-0.30 per 1000 images**

### Qdrant Cloud Costs
- **Free Tier**: 1GB storage (~10,000-50,000 image embeddings)
- **Paid Tier**: $25/month for 4GB

**Total Estimated Cost for 1000 images/month:**
- Heroku: $5-7/month
- OpenAI: $0.20-0.30
- Qdrant: Free tier
- **Total: ~$5-7.30/month**

## 🔍 Troubleshooting

### Error: "Module not found"

Ensure all dependencies are in `requirements.txt` and redeploy:

```bash
git add requirements.txt
git commit -m "Update dependencies"
git push heroku main
```

### Error: "Application error" / "H10"

Check logs for details:

```bash
heroku logs --tail
```

Common issues:
- Missing environment variables
- Wrong `Procfile` configuration
- Python version mismatch

### Error: "Image description unavailable"

Check OpenAI API key is set correctly:

```bash
heroku config:get OPENAI_API_KEY
heroku config:get IMAGE_DESCRIPTION_PROVIDER
```

Should show `openai` for provider.

### Error: "Vector search service unavailable"

Check Qdrant Cloud settings:

```bash
heroku config:get QDRANT_URL
heroku config:get QDRANT_API_KEY
```

Test Qdrant connection:
```bash
curl https://your-cluster.qdrant.io/collections \
  -H "api-key: your-api-key"
```

### High Memory Usage

The CLIP model requires ~1GB RAM. If you hit memory limits:

1. **Upgrade to Standard dyno** ($25/month, 512MB RAM):
   ```bash
   heroku ps:scale web=1:standard-1x
   ```

2. **Or use Performance dyno** ($250/month, 2.5GB RAM):
   ```bash
   heroku ps:scale web=1:performance-m
   ```

### Slow Cold Starts

Heroku Eco dynos sleep after 30 minutes of inactivity.

Solutions:
- **Upgrade to Basic dyno** ($7/month, no sleep)
- **Use Heroku Scheduler** (free) to ping every 10 minutes
- **Add health check endpoint** to keep it warm

## 🔐 Security Best Practices

1. **Never commit API keys** to git
2. **Use Heroku config vars** for all secrets
3. **Enable HTTPS** (automatic on Heroku)
4. **Restrict CORS** in production (update `main.py`)
5. **Set rate limits** to prevent abuse

## 🚀 Performance Optimization

### Enable Gunicorn Workers

Update `Procfile`:

```
web: gunicorn main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

Add to `requirements.txt`:
```
gunicorn
```

### Use CDN for Static Assets

If you serve model files, use AWS S3 or CloudFront.

### Enable Redis Caching

Cache image descriptions to avoid re-analysis:

```bash
heroku addons:create heroku-redis:mini
```

## 📚 Alternative Deployment Options

### Option 1: AWS Lambda (Serverless)
- **Pros**: Pay per use, scales automatically
- **Cons**: Cold starts, 10GB memory limit
- **Best for**: Low traffic, sporadic usage

### Option 2: Google Cloud Run
- **Pros**: Fully managed containers, better pricing
- **Cons**: More setup required
- **Best for**: Medium traffic, containerized apps

### Option 3: DigitalOcean App Platform
- **Pros**: Similar to Heroku, cheaper
- **Cons**: Fewer add-ons
- **Best for**: Cost-conscious deployments

### Option 4: Railway
- **Pros**: Free tier, easy deployment
- **Cons**: Smaller ecosystem
- **Best for**: Startups, side projects

## 🔄 Continuous Deployment

### GitHub Integration

1. Go to Heroku Dashboard → Deploy tab
2. Connect to GitHub
3. Enable automatic deploys from `main` branch
4. Optionally enable "Wait for CI to pass"

### Using Heroku Pipelines

Create staging and production environments:

```bash
# Create pipeline
heroku pipelines:create your-app-name

# Add apps to pipeline
heroku pipelines:add your-app-name-staging --stage staging
heroku pipelines:add your-app-name-production --stage production

# Promote staging to production
heroku pipelines:promote --app your-app-name-staging
```

## 📞 Support

- **Heroku Docs**: https://devcenter.heroku.com
- **OpenAI Docs**: https://platform.openai.com/docs
- **Qdrant Docs**: https://qdrant.tech/documentation

---

**Status**: Ready for Heroku Deployment ✅
**Last Updated**: January 2026
