# CX DAM Architecture Documentation

## System Overview

CX DAM is a distributed system consisting of:
1. **React Frontend** - User interface
2. **Node.js Backend** - API server and business logic
3. **PostgreSQL Database** - Metadata storage
4. **AWS S3** - Binary asset storage
5. **GitHub OAuth** - Identity provider

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client Browser                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React Frontend (Port 3000)                              │   │
│  │  - React Router                                          │   │
│  │  - TanStack Query (React Query)                         │   │
│  │  - Zustand State Management                             │   │
│  │  - Axios HTTP Client                                    │   │
│  └───────────────┬──────────────────────────────────────────┘   │
└──────────────────┼──────────────────────────────────────────────┘
                   │ HTTP/HTTPS
                   │ (JWT in HttpOnly Cookie)
┌──────────────────▼──────────────────────────────────────────────┐
│              Node.js Backend (Port 3001)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Express.js API Server                                   │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Middleware Layer                                   │  │   │
│  │  │ - Auth (JWT validation)                            │  │   │
│  │  │ - Permission checks                                │  │   │
│  │  │ - Error handling                                   │  │   │
│  │  │ - Request logging (Morgan)                         │  │   │
│  │  │ - Security (Helmet, CORS)                          │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Route Handlers                                     │  │   │
│  │  │ - /api/auth/*  (Authentication)                   │  │   │
│  │  │ - /api/assets/* (Asset management)                │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Service Layer                                      │  │   │
│  │  │ - GitHubService (OAuth, permissions)              │  │   │
│  │  │ - S3Service (Presigned URLs)                      │  │   │
│  │  │ - BloomFilterService (Name uniqueness)            │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Repository Layer (Data Access)                     │  │   │
│  │  │ - UserRepository                                   │  │   │
│  │  │ - AssetRepository                                  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────┬─────────────────┬──────────────┬──────────────┘
                  │                 │              │
                  │                 │              │
      ┌───────────▼──────┐  ┌──────▼─────┐  ┌────▼─────────────┐
      │   PostgreSQL     │  │   AWS S3   │  │  GitHub OAuth    │
      │   Database       │  │   Bucket   │  │  API             │
      │                  │  │            │  │                  │
      │  - users         │  │  Assets:   │  │  - User info     │
      │  - assets        │  │  /repo/    │  │  - Org check     │
      │  - bloom_filter  │  │    /type/  │  │  - Permissions   │
      └──────────────────┘  └────────────┘  └──────────────────┘
```

## Data Flow

### 1. Authentication Flow

```
┌──────────┐                 ┌──────────┐                ┌─────────┐
│ Frontend │                 │ Backend  │                │ GitHub  │
└────┬─────┘                 └────┬─────┘                └────┬────┘
     │                            │                           │
     │ 1. Click "Login"           │                           │
     ├──────────────────────────► │                           │
     │                            │                           │
     │ 2. Redirect to GitHub      │                           │
     │ ◄──────────────────────────┤                           │
     │                            │                           │
     │ 3. User authorizes app     │                           │
     ├────────────────────────────────────────────────────► │
     │                            │                           │
     │ 4. Callback with code      │                           │
     ◄────────────────────────────────────────────────────── │
     │                            │                           │
     │ 5. Send code to backend    │                           │
     ├──────────────────────────► │                           │
     │                            │                           │
     │                            │ 6. Exchange code for token│
     │                            ├─────────────────────────► │
     │                            │                           │
     │                            │ 7. Get access token       │
     │                            │ ◄─────────────────────────┤
     │                            │                           │
     │                            │ 8. Get user info          │
     │                            ├─────────────────────────► │
     │                            │                           │
     │                            │ 9. User data              │
     │                            │ ◄─────────────────────────┤
     │                            │                           │
     │                            │ 10. Check org membership  │
     │                            ├─────────────────────────► │
     │                            │                           │
     │                            │ 11. Get repo permissions  │
     │                            ├─────────────────────────► │
     │                            │                           │
     │                            │ 12. Store user in DB      │
     │                            │                           │
     │ 13. Set JWT cookie         │                           │
     │ ◄──────────────────────────┤                           │
     │                            │                           │
     │ 14. Redirect to app        │                           │
     │ ◄──────────────────────────┤                           │
     │                            │                           │
```

### 2. Asset Upload Flow

```
┌──────────┐              ┌──────────┐              ┌──────────┐
│ Frontend │              │ Backend  │              │   S3     │
└────┬─────┘              └────┬─────┘              └────┬─────┘
     │                         │                         │
     │ 1. Select file          │                         │
     │                         │                         │
     │ 2. Request upload URL   │                         │
     ├───────────────────────► │                         │
     │ (name, workspace, etc)  │                         │
     │                         │                         │
     │                         │ 3. Check permission     │
     │                         │ (GitHub repo access)    │
     │                         │                         │
     │                         │ 4. Check name uniqueness│
     │                         │ (Bloom Filter)          │
     │                         │                         │
     │                         │ 5. Generate presigned URL
     │                         ├───────────────────────► │
     │                         │                         │
     │                         │ 6. Return presigned URL │
     │                         │ ◄───────────────────────┤
     │                         │                         │
     │                         │ 7. Create asset in DB   │
     │                         │                         │
     │                         │ 8. Add to Bloom Filter  │
     │                         │                         │
     │ 9. Return upload URL    │                         │
     │ ◄───────────────────────┤                         │
     │                         │                         │
     │ 10. Upload file to S3   │                         │
     ├─────────────────────────────────────────────────► │
     │ (Direct PUT request)    │                         │
     │                         │                         │
     │ 11. Upload complete     │                         │
     │ ◄─────────────────────────────────────────────────┤
     │                         │                         │
```

### 3. Asset Search Flow

```
┌──────────┐              ┌──────────┐              ┌──────────┐
│ Frontend │              │ Backend  │              │ Database │
└────┬─────┘              └────┬─────┘              └────┬─────┘
     │                         │                         │
     │ 1. Enter search query   │                         │
     │                         │                         │
     │ 2. Send search request  │                         │
     ├───────────────────────► │                         │
     │ (q, tags, workspace)    │                         │
     │                         │                         │
     │                         │ 3. Build SQL query      │
     │                         │                         │
     │                         │ 4. Execute search       │
     │                         ├───────────────────────► │
     │                         │                         │
     │                         │ 5. Return results       │
     │                         │ ◄───────────────────────┤
     │                         │                         │
     │                         │ 6. Generate download URLs
     │                         │ (presigned URLs for S3) │
     │                         │                         │
     │ 7. Return results       │                         │
     │ ◄───────────────────────┤                         │
     │ (with download URLs)    │                         │
     │                         │                         │
```

## Component Architecture

### Shared Package

The `@cx-dam/shared` package contains code shared between frontend and backend:

```
packages/shared/
├── types/
│   ├── user.types.ts       # User and permission types
│   ├── asset.types.ts      # Asset types and schemas
│   └── api.types.ts        # API response types
├── utils/
│   ├── validation.ts       # Zod validation helpers
│   └── bloom-filter.ts     # Bloom Filter implementation
└── constants/
    └── permissions.ts      # Permission checking logic
```

### Backend Architecture

```
apps/backend/
├── config/
│   └── index.ts           # Configuration management
├── db/
│   ├── client.ts          # PostgreSQL connection pool
│   ├── schema.sql         # Database schema
│   └── migrate.ts         # Migration script
├── middleware/
│   ├── auth.middleware.ts       # JWT authentication
│   ├── permission.middleware.ts # Permission checks
│   └── error.middleware.ts      # Error handling
├── services/
│   ├── github.service.ts        # GitHub API integration
│   ├── s3.service.ts            # S3 operations
│   └── bloom-filter.service.ts  # Bloom Filter management
├── repositories/
│   ├── user.repository.ts       # User data access
│   └── asset.repository.ts      # Asset data access
├── routes/
│   ├── auth.routes.ts           # Authentication endpoints
│   ├── asset.routes.ts          # Asset endpoints
│   └── index.ts                 # Route aggregation
├── utils/
│   └── logger.ts                # Winston logger
├── app.ts                       # Express app setup
└── index.ts                     # Server entry point
```

### Frontend Architecture

```
apps/frontend/
├── api/
│   ├── client.ts          # Axios configuration
│   ├── auth.api.ts        # Auth API calls
│   └── asset.api.ts       # Asset API calls
├── components/
│   └── Layout.tsx         # App layout with nav
├── pages/
│   ├── HomePage.tsx       # Landing page
│   ├── SearchPage.tsx     # Asset search
│   ├── UploadPage.tsx     # Asset upload
│   └── AuthCallback.tsx   # OAuth callback handler
├── stores/
│   └── auth.store.ts      # Zustand auth state
├── App.tsx                # Root component with routes
└── main.tsx               # Entry point
```

## Key Design Decisions

### 1. Presigned URLs for S3 Uploads

**Why:**
- Reduces backend load (no proxying large files)
- Faster uploads (direct to S3)
- Better scalability
- Secure with time-limited URLs

**How:**
- Backend generates presigned URL with PUT permissions
- Frontend uploads directly to S3
- Backend creates metadata record before returning URL

### 2. Bloom Filter for Name Uniqueness

**Why:**
- O(1) lookup for "definitely doesn't exist" cases
- Reduces database queries by ~99%
- Minimal memory footprint
- Persisted to database for durability

**How:**
- Each workspace has its own Bloom Filter
- Filter loaded into memory on first access
- Names added to filter on asset creation
- False positives verified with database query

### 3. GitHub-based Authorization

**Why:**
- No separate permission system to maintain
- Leverages existing GitHub access controls
- Single source of truth for permissions
- Familiar to developers

**How:**
- OAuth flow gets user identity
- Fetch repository permissions via GitHub API
- Map GitHub permissions to app permission levels
- Store in JWT for fast authorization checks

### 4. Workspace = GitHub Repository

**Why:**
- Natural organizational boundary
- Aligns with existing workflows
- Easy to understand and manage
- Supports multi-tenancy

**How:**
- Asset workspace field stores `org/repo` format
- S3 keys prefixed with workspace
- Search can filter by workspace
- Permissions checked per workspace

### 5. Monorepo with Turborepo

**Why:**
- Shared code between frontend and backend
- Consistent tooling and dependencies
- Faster CI/CD with intelligent caching
- Easier refactoring across packages

**How:**
- npm workspaces for dependency management
- Turborepo for build orchestration
- Shared package for common code
- Independent deployment of apps

## Security Model

### Authentication
- GitHub OAuth 2.0 flow
- JWT tokens stored in HttpOnly cookies
- Token includes user ID, permissions, org membership
- Token expiry: 7 days (configurable)

### Authorization
- Middleware checks JWT on protected routes
- Permission levels mapped from GitHub
- Workspace-level permission checks
- Org membership required for replace operations

### Data Protection
- No secrets in frontend code
- Presigned URLs expire after 15 minutes (upload) or 1 hour (download)
- SQL injection prevention via parameterized queries
- Input validation with Zod schemas
- CORS restricted to frontend origin
- Helmet security headers

## Performance Optimizations

1. **Bloom Filters**: Reduce database queries for uniqueness checks
2. **Database Indexes**: Full-text search index on asset names
3. **Connection Pooling**: PostgreSQL connection pool (max 20)
4. **React Query Caching**: Client-side caching of API responses
5. **Presigned URLs**: Direct S3 access without backend proxy
6. **Pagination**: Limit query results to 20 items per page

## Scalability Considerations

### Current Architecture
- Single backend server
- Single PostgreSQL instance
- S3 for unlimited storage
- Stateless backend (horizontal scaling ready)

### Future Enhancements
- Add Redis for session storage and caching
- Implement API rate limiting
- Add CDN for asset delivery
- Database read replicas
- Multi-region S3 with CloudFront
- Kubernetes deployment for auto-scaling

## Error Handling

### Backend
- Centralized error middleware
- Typed error classes (AppError, ValidationError)
- Structured logging with Winston
- Graceful degradation

### Frontend
- React Query error boundaries
- User-friendly error messages
- Retry logic for network errors
- Toast notifications for errors

## Testing Strategy

### Unit Tests
- Service layer logic
- Repository methods
- Utility functions
- Permission checks

### Integration Tests
- API endpoint testing
- Database interactions
- S3 operations
- Auth flow

### E2E Tests
- User registration and login
- Asset upload workflow
- Search functionality
- Permission enforcement

## Deployment Architecture

```
┌────────────────────────────────────────────────────────────┐
│                         AWS Cloud                          │
│                                                            │
│  ┌─────────────┐      ┌─────────────┐    ┌────────────┐  │
│  │   Route53   │      │  CloudFront │    │    S3      │  │
│  │   (DNS)     ├─────►│    (CDN)    ├───►│  (Static)  │  │
│  └─────────────┘      └─────────────┘    └────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Application Load Balancer              │  │
│  └────────┬────────────────────────────────────────────┘  │
│           │                                                │
│  ┌────────▼──────────────────────────┐                    │
│  │        ECS/Fargate Cluster        │                    │
│  │  ┌──────────┐    ┌──────────┐    │                    │
│  │  │ Backend  │    │ Backend  │    │                    │
│  │  │Container │    │Container │    │                    │
│  │  └─────┬────┘    └─────┬────┘    │                    │
│  └────────┼───────────────┼─────────┘                    │
│           │               │                                │
│           └───────┬───────┘                                │
│                   │                                        │
│         ┌─────────▼─────────┐         ┌────────────┐     │
│         │    RDS Postgres   │         │     S3     │     │
│         │   (Multi-AZ)      │         │  (Assets)  │     │
│         └───────────────────┘         └────────────┘     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## Monitoring & Observability

- **Application Logs**: Winston structured JSON logs
- **Request Logs**: Morgan HTTP request logging
- **Error Tracking**: Centralized error handler with stack traces
- **Health Checks**: `/api/health` endpoint
- **Metrics**: Response times, error rates, upload sizes

Future additions:
- APM tool (New Relic, Datadog)
- Log aggregation (CloudWatch, ELK stack)
- Distributed tracing
- Performance monitoring
- Alert systems
