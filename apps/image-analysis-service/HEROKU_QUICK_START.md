# ⚡ Heroku Quick Start Guide

Deploy the image analysis service to Heroku in 5 minutes.

## Prerequisites
- Heroku CLI installed
- OpenAI API key (https://platform.openai.com/api-keys)
- Qdrant Cloud cluster (https://cloud.qdrant.io - free tier)

## Quick Deploy

```bash
# 1. Navigate to service directory
cd apps/image-analysis-service

# 2. Login and create app
heroku login
heroku create your-app-name

# 3. Set environment variables
heroku config:set IMAGE_DESCRIPTION_PROVIDER=openai
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set OPENAI_VISION_MODEL=gpt-4o-mini
heroku config:set QDRANT_URL=https://xxx.qdrant.io
heroku config:set QDRANT_API_KEY=your-key
heroku config:set CONTENT_MODERATION_THRESHOLD=0.6

# 4. Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# 5. Start dyno
heroku ps:scale web=1

# 6. Test
curl https://your-app-name.herokuapp.com/health
```

## Environment Variables Summary

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `IMAGE_DESCRIPTION_PROVIDER` | Yes | `openai` | Use `openai` for Heroku |
| `OPENAI_API_KEY` | Yes | `sk-proj-...` | From OpenAI dashboard |
| `OPENAI_VISION_MODEL` | No | `gpt-4o-mini` | Default: gpt-4o-mini |
| `QDRANT_URL` | Yes | `https://xxx.qdrant.io` | From Qdrant Cloud |
| `QDRANT_API_KEY` | Yes | `your-key` | From Qdrant Cloud |
| `CONTENT_MODERATION_THRESHOLD` | No | `0.6` | Default: 0.6 (60%) |

## Update Backend

Update your Express backend `.env`:

```bash
IMAGE_ANALYSIS_SERVICE_URL=https://your-app-name.herokuapp.com
```

## Costs

- **Heroku Eco Dyno**: $5/month (or free with student pack)
- **OpenAI (gpt-4o-mini)**: ~$0.20 per 1000 images
- **Qdrant Cloud**: Free tier (1GB)

**Total**: ~$5-7/month for moderate usage

## Monitoring

```bash
# View logs
heroku logs --tail

# Check status
heroku ps

# View config
heroku config
```

## Common Issues

**Error: H10 (App crashed)**
- Check logs: `heroku logs --tail`
- Verify all env vars are set: `heroku config`

**Error: Module not found**
- Ensure `requirements.txt` is up to date
- Redeploy: `git push heroku main`

**Image description unavailable**
- Verify: `heroku config:get OPENAI_API_KEY`
- Should return your API key

**Vector search unavailable**
- Verify: `heroku config:get QDRANT_URL`
- Test: `curl https://your-cluster.qdrant.io/collections -H "api-key: your-key"`

## Performance Tips

1. **Upgrade to Basic dyno** ($7/month) to prevent sleep
2. **Use Gunicorn** with multiple workers for better concurrency
3. **Enable caching** for repeated image descriptions

See [HEROKU_DEPLOYMENT.md](./HEROKU_DEPLOYMENT.md) for detailed instructions.
