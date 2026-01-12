# CX DAM - Digital Asset Management Platform

A production-ready Digital Asset Management (DAM) system built with TypeScript, Node.js, React, PostgreSQL, and AWS S3. Features GitHub-based authentication and authorization with repository-level permissions.

## 📦 Project Structure

```
cx-dam/
├── apps/
│   ├── backend/          # Node.js + Express API server
│   └── frontend/         # React + Vite web application
├── packages/
│   └── shared/           # Shared TypeScript types, utilities, and business logic
├── .env.example          # Environment variables template
├── package.json          # Root package.json with workspace configuration
└── turbo.json           # Turborepo configuration for monorepo management
```

## 🚀 Features

### Core Functionality
- **Asset Upload & Management**: Upload images, videos, archives, and documents to S3
- **Search & Discovery**: Full-text search with tag filtering
- **GitHub OAuth**: Secure authentication via GitHub
- **Repository-based Workspaces**: Assets organized by GitHub repository
- **Presigned URLs**: Direct S3 uploads for better performance and security
- **Bloom Filter**: Fast name uniqueness checking with minimal database queries

### Security & Authorization
- **GitHub Organization**: Restrict access to `salesforcedocs` org members
- **Repository Permissions**:
  - **Viewer**: Search and view assets
  - **Contributor**: Upload new assets (write access)
  - **Maintainer+**: Replace existing assets
  - **Admin**: Full access
- **Unauthenticated Users**: Can search and view public assets

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL (with full-text search)
- **Storage**: AWS S3 with presigned URLs
- **Auth**: GitHub OAuth 2.0 + JWT
- **Validation**: Zod schemas
- **Logging**: Winston
- **Security**: Helmet, CORS

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: Zustand
- **Data Fetching**: TanStack Query (React Query)
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS

### Shared
- **Type Safety**: Zod schemas for runtime validation
- **Bloom Filter**: Custom implementation for performance optimization
- **Permission System**: Centralized authorization logic

## 📋 Prerequisites

- Node.js 20.x or higher
- npm 10.x or higher
- PostgreSQL 14+ (local or RDS)
- AWS account with S3 access
- GitHub OAuth App credentials

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone git@github.com:sfdocs/cx-dam.git
cd cx-dam
```

### 2. Install Dependencies

```bash
npm install
```

This will install dependencies for all workspaces (root, backend, frontend, shared).

### 3. Set Up GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: CX DAM (or your choice)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3001/api/auth/github/callback`
4. Save the `Client ID` and `Client Secret`

### 4. Set Up AWS S3

1. Create an S3 bucket for asset storage
2. Configure bucket CORS policy:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["http://localhost:3000"],
    "ExposeHeaders": ["ETag"]
  }
]
```

3. Create IAM user with S3 access:
   - `s3:PutObject`
   - `s3:GetObject`
   - `s3:DeleteObject`

4. Save Access Key ID and Secret Access Key

### 5. Set Up PostgreSQL Database

```bash
# Create database
createdb cxdam

# Or using psql
psql -U postgres
CREATE DATABASE cxdam;
\q
```

### 6. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/api/auth/github/callback
GITHUB_ORG=salesforcedocs

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cxdam

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=cx-dam-assets

# JWT
JWT_SECRET=your_random_32_character_secret_here
JWT_EXPIRY=7d

# API
API_PORT=3001
API_BASE_URL=http://localhost:3001
FRONTEND_PORT=3000
FRONTEND_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

# Step-by-Step Guide for local Development

## Github Oauth App

  1. Go to GitHub Settings

  1. Log into GitHub
  2. Click your profile picture (top right) → Settings
  3. Scroll down to Developer settings (bottom of left sidebar)
  4. Click OAuth Apps
  5. Click New OAuth App button

  2. Fill in Application Details

  Application name: CX DAM Local Development
  Homepage URL: http://localhost:3000
  Application description: Digital Asset Management - Local Dev (optional)
  Authorization callback URL: http://localhost:3001/api/auth/github/callback

  Important:
  - The callback URL must match exactly: http://localhost:3001/api/auth/github/callback
  - Port 3001 is where your backend runs
  - Don't add trailing slash

## Postgraes URL
- Copy `DATABASE_URL` config from https://dashboard.heroku.com/apps/cx-dam/settings

## S3 URL details

### 7. Run Database Migrations

```bash
cd apps/backend
npm run migrate
cd ../..
```

### 8. Build Shared Package

```bash
npm run build
```

## 🚀 Running the Application

### Development Mode

Run all services concurrently:

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

Or run individually:

```bash
# Backend only
cd apps/backend
npm run dev

# Frontend only
cd apps/frontend
npm run dev
```

### Production Build

```bash
# Build all packages
npm run build

# Start backend
cd apps/backend
npm start

# Serve frontend
cd apps/frontend
npm run preview
```

## 📚 API Documentation

### Authentication Endpoints

#### `GET /api/auth/github`
Redirects to GitHub OAuth login page.

#### `GET /api/auth/github/callback`
OAuth callback endpoint. Handles GitHub authentication and creates user session.

#### `GET /api/auth/me`
Returns current authenticated user session.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "login": "..." },
    "permissions": [{ "repoFullName": "org/repo", "permission": "contributor" }],
    "belongsToOrg": true
  }
}
```

#### `POST /api/auth/logout`
Logs out the current user.

### Asset Endpoints

#### `POST /api/assets/upload-url`
Request a presigned URL for uploading an asset.

**Auth Required**: Yes
**Permission**: Write access to workspace

**Request Body:**
```json
{
  "name": "my-image.png",
  "workspace": "salesforcedocs/documentation",
  "tags": ["screenshot", "v2.0"],
  "mimeType": "image/png",
  "size": 102400
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://s3.amazonaws.com/...",
    "assetId": "uuid",
    "s3Key": "salesforcedocs/documentation/images/..."
  }
}
```

#### `GET /api/assets/validate-name?name=xxx&workspace=yyy`
Check if an asset name is unique in a workspace using Bloom Filter.

**Response:**
```json
{
  "success": true,
  "data": { "isUnique": true }
}
```

#### `GET /api/assets/search?q=&tags=&workspace=&fileType=&page=1&limit=20`
Search assets with pagination.

**Query Parameters:**
- `q`: Search term (optional)
- `tags`: Comma-separated tags (optional)
- `workspace`: Filter by repository (optional)
- `fileType`: Filter by type (image, video, archive, document, other)
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "asset.png",
        "workspace": "salesforcedocs/docs",
        "tags": ["screenshot"],
        "fileType": "image",
        "size": 102400,
        "downloadUrl": "https://...",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

#### `GET /api/assets/:id`
Get asset details by ID.

#### `PUT /api/assets/:id/replace`
Replace an existing asset (maintainer+ only).

#### `DELETE /api/assets/:id`
Delete an asset (owner or maintainer+).

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e
```

## 🏗️ Architecture

### Upload Flow

1. **Frontend** requests upload URL from backend
2. **Backend** validates permissions and generates presigned S3 URL
3. **Backend** creates asset record in database
4. **Backend** adds asset name to Bloom Filter
5. **Backend** returns presigned URL to frontend
6. **Frontend** uploads file directly to S3 using presigned URL
7. User can now search and access the asset

### Permission System

```
┌─────────────────────────────────────────────────────┐
│ GitHub OAuth                                        │
│ ↓                                                   │
│ Check org membership (salesforcedocs)              │
│ ↓                                                   │
│ Get repository permissions                         │
│ ↓                                                   │
│ Map to permission levels:                          │
│   - admin → ADMIN                                  │
│   - maintain → MAINTAINER                          │
│   - write → CONTRIBUTOR                            │
│   - read → VIEWER                                  │
│ ↓                                                   │
│ Store in JWT session                               │
└─────────────────────────────────────────────────────┘
```

### Bloom Filter for Name Uniqueness

- Each workspace has its own Bloom Filter
- Filters are persisted in PostgreSQL
- Provides O(1) negative lookups (definitely doesn't exist)
- False positive rate: ~1% (configurable)
- Significantly reduces database queries for uniqueness checks

## 📁 Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    github_id INTEGER UNIQUE NOT NULL,
    login VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Assets Table
```sql
CREATE TABLE assets (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    workspace VARCHAR(255) NOT NULL,
    tags TEXT[],
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(name, workspace)
);
```

## 🔐 Security Considerations

1. **No Secrets in Frontend**: All sensitive operations happen on backend
2. **Presigned URLs**: Direct S3 access with time-limited URLs
3. **JWT Tokens**: HttpOnly cookies for session management
4. **Permission Checks**: Middleware validates GitHub permissions on every request
5. **Input Validation**: Zod schemas validate all inputs
6. **SQL Injection Prevention**: Parameterized queries throughout
7. **CORS**: Restricted to frontend origin
8. **Helmet**: Security headers enabled

## 🚢 Deployment

### Backend (Node.js)
- Deploy to AWS ECS, Heroku, or any Node.js hosting
- Set environment variables
- Run migrations: `npm run migrate`
- Start server: `npm start`

### Frontend (React)
- Build: `npm run build`
- Deploy to Vercel, Netlify, AWS S3 + CloudFront, etc.
- Configure environment variables for API URL

### Database
- Use AWS RDS for PostgreSQL
- Enable connection pooling
- Regular backups

### S3
- Use CloudFront for CDN
- Enable versioning
- Configure lifecycle policies for old assets

## 📊 Monitoring & Observability

- **Logging**: Winston with structured JSON logs
- **Error Tracking**: Centralized error handler
- **Request Logging**: Morgan middleware
- **Health Check**: `GET /api/health`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 TODOs

### High Priority
- [ ] Implement rate limiting on API endpoints
- [ ] Add Redis caching for frequent queries
- [ ] Implement asset preview thumbnails

### Medium Priority
- [ ] Add bulk upload functionality
- [ ] Implement asset versioning
- [ ] Add audit logs for all operations
- [ ] Add asset usage analytics
- [ ] Implement asset tagging suggestions

### Low Priority
- [ ] Add asset metadata extraction (EXIF, etc.)
- [ ] Implement CDN integration

## 📄 License

MIT License - See LICENSE file for details

## 💬 Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ for the Salesforce Documentation Team**
