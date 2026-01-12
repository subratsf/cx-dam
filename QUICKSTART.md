# CX DAM - Quick Start Guide

Get up and running with CX DAM in 5 minutes!

## Prerequisites

- Node.js 20+ and npm 10+
- PostgreSQL 14+
- AWS account with S3
- GitHub account

## Installation

### 1. Clone and Install

```bash
git clone <repository-url>
cd cx-dam
./setup.sh
```

Or manually:

```bash
npm install
npm run build
cp .env.example .env
```

### 2. Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **"New OAuth App"**
3. Fill in:
   - **Application name**: `CX DAM Local`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3001/api/auth/github/callback`
4. Click **"Register application"**
5. Copy the **Client ID**
6. Click **"Generate a new client secret"** and copy it

### 3. Set Up Database

```bash
# Create database
createdb cxdam

# Or using psql
psql -U postgres
CREATE DATABASE cxdam;
\q
```

### 4. Create S3 Bucket (Development)

**Option A: Use AWS S3 (Recommended for production-like testing)**

```bash
# Create bucket
aws s3 mb s3://cx-dam-dev-bucket

# Configure CORS
cat > cors.json <<EOF
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["http://localhost:3000"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF

aws s3api put-bucket-cors --bucket cx-dam-dev-bucket --cors-configuration file://cors.json
```

**Option B: Use LocalStack (Local S3 simulation)**

```bash
npm install -g @localstack/cli
localstack start
```

Then use these in your `.env`:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET_NAME=cx-dam-dev-bucket
```

### 5. Configure Environment

Edit `.env` with your credentials:

```env
# GitHub OAuth (from step 2)
GITHUB_CLIENT_ID=Iv1.your_client_id_here
GITHUB_CLIENT_SECRET=ghp_your_secret_here
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
GITHUB_ORG=salesforcedocs

# Database (from step 3)
DATABASE_URL=postgresql://postgres:password@localhost:5432/cxdam

# AWS S3 (from step 4)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=cx-dam-dev-bucket

# JWT (generate a random 32+ character string)
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRY=7d

# API
API_PORT=3001
API_BASE_URL=http://localhost:3001
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

### 6. Run Database Migrations

```bash
cd apps/backend
npm run migrate
cd ../..
```

### 7. Start Development

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## First Use

1. Open http://localhost:3000
2. Click **"Login with GitHub"**
3. Authorize the application
4. You'll be redirected back to the app, logged in!
5. Click **"Upload"** to upload your first asset

## Troubleshooting

### Build Fails

```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Error

```bash
# Check if PostgreSQL is running
psql -U postgres -l

# Test connection
psql $DATABASE_URL
```

### GitHub OAuth "Redirect URI mismatch"

Make sure the callback URL in your GitHub OAuth app is **exactly**:
```
http://localhost:3001/api/auth/github/callback
```

No trailing slash!

### S3 Upload Fails

Check your AWS credentials:
```bash
aws s3 ls s3://cx-dam-dev-bucket
```

### Port Already in Use

```bash
# Find and kill process on port 3000 or 3001
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

## Development Commands

```bash
# Start all services
npm run dev

# Build all packages
npm run build

# Run tests
npm test

# Type check
npm run type-check

# Clean build artifacts
npm run clean

# Format code
npm run format
```

## Project Structure

```
cx-dam/
├── apps/
│   ├── backend/          # API server (port 3001)
│   └── frontend/         # React app (port 3000)
├── packages/
│   └── shared/           # Shared types and utilities
├── .env                  # Your configuration (git-ignored)
├── setup.sh             # Setup script
└── README.md            # Full documentation
```

## Next Steps

- Read [README.md](./README.md) for full documentation
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines
- Review [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment

## Common Workflows

### Upload an Asset

1. Log in with GitHub
2. Navigate to **Upload** page
3. Select a file
4. Choose a repository (workspace)
5. Add tags (optional)
6. Click **Upload**

### Search for Assets

1. Go to **Search Assets** page
2. Enter search query or tags
3. Filter by workspace or file type
4. Click on assets to download

### Check Permissions

Your permissions are based on your GitHub repository access:
- **Viewer**: Can search and view assets
- **Contributor**: Can upload new assets (write access)
- **Maintainer**: Can replace existing assets
- **Admin**: Full access

## Support

- GitHub Issues: Report bugs or request features
- Documentation: See full docs in README.md
- Architecture: See ARCHITECTURE.md for technical details

---

**Ready to start?** Run `npm run dev` and open http://localhost:3000! 🚀
