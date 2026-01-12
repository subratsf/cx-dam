# Deployment Guide

This guide covers deploying CX DAM to production environments.

## Prerequisites

- AWS account with appropriate permissions
- GitHub OAuth app configured for production
- Domain name (optional but recommended)
- CI/CD pipeline (GitHub Actions, GitLab CI, etc.)

## Environment Setup

### 1. AWS Infrastructure

#### S3 Bucket

```bash
# Create S3 bucket
aws s3 mb s3://cx-dam-assets-prod

# Configure CORS
aws s3api put-bucket-cors --bucket cx-dam-assets-prod --cors-configuration file://s3-cors.json
```

`s3-cors.json`:
```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["https://yourdomain.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

#### RDS PostgreSQL

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier cx-dam-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 15.3 \
  --master-username cxdam \
  --master-user-password <password> \
  --allocated-storage 20 \
  --backup-retention-period 7 \
  --multi-az \
  --storage-encrypted
```

#### IAM User for S3 Access

```bash
# Create IAM user
aws iam create-user --user-name cx-dam-s3-user

# Attach S3 policy
aws iam put-user-policy --user-name cx-dam-s3-user \
  --policy-name S3Access \
  --policy-document file://s3-policy.json

# Create access keys
aws iam create-access-key --user-name cx-dam-s3-user
```

`s3-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::cx-dam-assets-prod",
        "arn:aws:s3:::cx-dam-assets-prod/*"
      ]
    }
  ]
}
```

### 2. Database Migration

```bash
# Connect to RDS
psql -h <rds-endpoint> -U cxdam -d postgres

# Create database
CREATE DATABASE cxdam_prod;

# Exit and run migrations
cd apps/backend
DATABASE_URL=postgresql://cxdam:<password>@<rds-endpoint>:5432/cxdam_prod npm run migrate
```

### 3. GitHub OAuth Production App

1. Create new GitHub OAuth App for production
2. Set Homepage URL: `https://yourdomain.com`
3. Set Callback URL: `https://api.yourdomain.com/api/auth/github/callback`
4. Save Client ID and Client Secret

## Deployment Options

### Option 1: Docker + AWS ECS

#### Build Docker Images

`apps/backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY turbo.json ./

# Copy packages
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install dependencies
RUN npm ci

# Build shared package
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/package.json ./apps/backend/
COPY --from=builder /app/apps/backend/src/db/schema.sql ./apps/backend/dist/db/

# Set working directory to backend
WORKDIR /app/apps/backend

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Build and push:
```bash
# Build image
docker build -f apps/backend/Dockerfile -t cx-dam-backend:latest .

# Tag for ECR
docker tag cx-dam-backend:latest <account-id>.dkr.ecr.<region>.amazonaws.com/cx-dam-backend:latest

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/cx-dam-backend:latest
```

#### ECS Task Definition

`ecs-task-definition.json`:
```json
{
  "family": "cx-dam-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "backend",
      "image": "<account-id>.dkr.ecr.<region>.amazonaws.com/cx-dam-backend:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "API_PORT", "value": "3001" }
      ],
      "secrets": [
        { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..." },
        { "name": "JWT_SECRET", "valueFrom": "arn:aws:secretsmanager:..." },
        { "name": "GITHUB_CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:..." },
        { "name": "GITHUB_CLIENT_SECRET", "valueFrom": "arn:aws:secretsmanager:..." }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/cx-dam-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

Deploy:
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name cx-dam-prod

# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# Create service
aws ecs create-service \
  --cluster cx-dam-prod \
  --service-name backend \
  --task-definition cx-dam-backend \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

### Option 2: Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create cx-dam-backend-prod

# Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

# Set environment variables
heroku config:set \
  NODE_ENV=production \
  GITHUB_CLIENT_ID=xxx \
  GITHUB_CLIENT_SECRET=xxx \
  JWT_SECRET=xxx \
  AWS_REGION=us-east-1 \
  AWS_ACCESS_KEY_ID=xxx \
  AWS_SECRET_ACCESS_KEY=xxx \
  S3_BUCKET_NAME=cx-dam-assets-prod

# Deploy
git subtree push --prefix apps/backend heroku main

# Run migrations
heroku run npm run migrate
```

### Option 3: Vercel (Backend) + Vercel (Frontend)

#### Backend Deployment

Create `vercel.json` in `apps/backend`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

Deploy:
```bash
cd apps/backend
npm run build
vercel --prod
```

#### Frontend Deployment

Create `vercel.json` in `apps/frontend`:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://api.yourdomain.com/api/:path*"
    }
  ]
}
```

Deploy:
```bash
cd apps/frontend
npm run build
vercel --prod
```

## Frontend Deployment

### Option 1: Vercel

```bash
cd apps/frontend
vercel --prod
```

Set environment variables in Vercel dashboard:
- `VITE_API_URL`: Your backend API URL

### Option 2: Netlify

```bash
cd apps/frontend
npm run build

# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod --dir=dist
```

`netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://api.yourdomain.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option 3: AWS S3 + CloudFront

```bash
# Build frontend
cd apps/frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://cx-dam-frontend-prod

# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name cx-dam-frontend-prod.s3.amazonaws.com \
  --default-root-object index.html
```

## Environment Variables

### Backend Production

```env
# Environment
NODE_ENV=production

# GitHub OAuth
GITHUB_CLIENT_ID=<production-client-id>
GITHUB_CLIENT_SECRET=<production-client-secret>
GITHUB_CALLBACK_URL=https://api.yourdomain.com/api/auth/github/callback
GITHUB_ORG=salesforcedocs

# Database
DATABASE_URL=postgresql://user:password@rds-endpoint:5432/cxdam_prod

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<production-access-key>
AWS_SECRET_ACCESS_KEY=<production-secret-key>
S3_BUCKET_NAME=cx-dam-assets-prod

# JWT
JWT_SECRET=<secure-random-32-char-string>
JWT_EXPIRY=7d

# API
API_PORT=3001
API_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Frontend Production

Environment variables are baked into the build, so set them before building:

```env
VITE_API_URL=https://api.yourdomain.com
```

## CI/CD Pipeline

### GitHub Actions

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Run tests
        run: npm test

      - name: Deploy to production
        run: |
          # Your deployment command here
          # e.g., deploy to Heroku, ECS, etc.
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          GITHUB_CLIENT_ID: ${{ secrets.GITHUB_CLIENT_ID }}
          # ... other secrets

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: |
          cd apps/frontend
          npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/frontend
```

## Post-Deployment Checklist

- [ ] Verify database migrations ran successfully
- [ ] Test GitHub OAuth login flow
- [ ] Test asset upload functionality
- [ ] Test asset search
- [ ] Verify presigned URLs work correctly
- [ ] Check application logs for errors
- [ ] Monitor API response times
- [ ] Verify CORS configuration
- [ ] Test with different GitHub permission levels
- [ ] Set up monitoring and alerts
- [ ] Configure automated backups
- [ ] Set up SSL certificates
- [ ] Configure custom domain DNS
- [ ] Enable CloudFront CDN (if using S3)
- [ ] Set up rate limiting
- [ ] Configure auto-scaling (if applicable)

## Rollback Procedure

### ECS Rollback
```bash
# List task definitions
aws ecs list-task-definitions --family-prefix cx-dam-backend

# Update service to previous version
aws ecs update-service \
  --cluster cx-dam-prod \
  --service backend \
  --task-definition cx-dam-backend:PREVIOUS_VERSION
```

### Heroku Rollback
```bash
# List releases
heroku releases

# Rollback to previous release
heroku rollback v123
```

## Monitoring

### CloudWatch (AWS)
- Set up alarms for API errors
- Monitor RDS performance
- Track S3 storage usage
- Monitor ECS task health

### Application Monitoring
- Set up error tracking (Sentry, Rollbar)
- Monitor API response times
- Track upload success rates
- Monitor database query performance

## Security Hardening

1. **Secrets Management**
   - Use AWS Secrets Manager or HashiCorp Vault
   - Rotate secrets regularly
   - Never commit secrets to git

2. **Network Security**
   - Use VPC for database
   - Security groups for EC2/RDS
   - Enable SSL/TLS everywhere
   - Use WAF for DDoS protection

3. **Database Security**
   - Enable encryption at rest
   - Use SSL for connections
   - Regular backups
   - Principle of least privilege

4. **Application Security**
   - Enable rate limiting
   - Implement CSRF protection
   - Regular dependency updates
   - Security headers (Helmet)

## Backup Strategy

### Database Backups
```bash
# Manual backup
pg_dump -h <rds-endpoint> -U cxdam cxdam_prod > backup-$(date +%Y%m%d).sql

# Restore
psql -h <rds-endpoint> -U cxdam cxdam_prod < backup-20240101.sql
```

### Automated Backups (AWS)
- RDS automated backups (7-day retention)
- Manual DB snapshots before major changes
- S3 versioning for assets
- Cross-region replication for disaster recovery

## Cost Optimization

1. **S3 Lifecycle Policies**
   - Move old assets to Glacier
   - Delete unused assets

2. **RDS Optimization**
   - Right-size instance
   - Use reserved instances
   - Enable auto-scaling storage

3. **CloudFront Caching**
   - Cache static assets
   - Set appropriate TTLs

4. **ECS/Fargate**
   - Use spot instances
   - Auto-scale based on load
   - Schedule down during off-hours (dev/staging)

## Support & Maintenance

- Monitor error logs daily
- Review performance metrics weekly
- Update dependencies monthly
- Conduct security audits quarterly
- Review and optimize costs monthly
- Test disaster recovery procedures quarterly
