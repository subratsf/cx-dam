#!/bin/bash

echo "🔍 Checking CX DAM Environment Configuration..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "   Run: cp .env.example .env"
    exit 1
fi

echo -e "${GREEN}✅ .env file found${NC}"
echo ""

# Source .env
set -a
source .env
set +a

# Check GitHub OAuth
echo "📋 GitHub OAuth Configuration:"
if [ -n "$GITHUB_CLIENT_ID" ] && [ "$GITHUB_CLIENT_ID" != "your_github_client_id" ]; then
    echo -e "   ${GREEN}✅${NC} GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID:0:10}..."
else
    echo -e "   ${RED}❌${NC} GITHUB_CLIENT_ID not set"
fi

if [ -n "$GITHUB_CLIENT_SECRET" ] && [ "$GITHUB_CLIENT_SECRET" != "your_github_client_secret" ]; then
    echo -e "   ${GREEN}✅${NC} GITHUB_CLIENT_SECRET: ****"
else
    echo -e "   ${RED}❌${NC} GITHUB_CLIENT_SECRET not set"
fi

if [ -n "$GITHUB_CALLBACK_URL" ]; then
    if [[ "$GITHUB_CALLBACK_URL" == *"/api/auth/github/callback" ]]; then
        echo -e "   ${GREEN}✅${NC} GITHUB_CALLBACK_URL: $GITHUB_CALLBACK_URL"
    else
        echo -e "   ${YELLOW}⚠️${NC}  GITHUB_CALLBACK_URL missing /api prefix: $GITHUB_CALLBACK_URL"
        echo "      Should be: http://localhost:3001/api/auth/github/callback"
    fi
else
    echo -e "   ${RED}❌${NC} GITHUB_CALLBACK_URL not set"
fi
echo ""

# Check Database
echo "🗄️  Database Configuration:"
if [ -n "$DATABASE_URL" ] && [ "$DATABASE_URL" != "postgresql://user:password@localhost:5432/cxdam" ]; then
    # Extract host from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
    echo -e "   ${GREEN}✅${NC} DATABASE_URL configured (host: $DB_HOST)"

    # Try to connect
    echo -n "   Testing database connection... "
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Connected${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot connect (might need migrations)${NC}"
    fi
else
    echo -e "   ${RED}❌${NC} DATABASE_URL not configured"
fi
echo ""

# Check AWS S3
echo "☁️  AWS S3 Configuration:"
if [ -n "$AWS_ACCESS_KEY_ID" ] && [ "$AWS_ACCESS_KEY_ID" != "your_access_key" ]; then
    echo -e "   ${GREEN}✅${NC} AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
else
    echo -e "   ${YELLOW}⚠️${NC}  AWS_ACCESS_KEY_ID not set (uploads will fail)"
fi

if [ -n "$AWS_SECRET_ACCESS_KEY" ] && [ "$AWS_SECRET_ACCESS_KEY" != "your_secret_key" ]; then
    echo -e "   ${GREEN}✅${NC} AWS_SECRET_ACCESS_KEY: ****"
else
    echo -e "   ${YELLOW}⚠️${NC}  AWS_SECRET_ACCESS_KEY not set (uploads will fail)"
fi

if [ -n "$S3_BUCKET_NAME" ] && [ "$S3_BUCKET_NAME" != "cx-dam-assets" ]; then
    echo -e "   ${GREEN}✅${NC} S3_BUCKET_NAME: $S3_BUCKET_NAME"
else
    echo -e "   ${YELLOW}⚠️${NC}  S3_BUCKET_NAME not configured (uploads will fail)"
fi

if [ -n "$AWS_REGION" ]; then
    echo -e "   ${GREEN}✅${NC} AWS_REGION: $AWS_REGION"
else
    echo -e "   ${RED}❌${NC} AWS_REGION not set"
fi
echo ""

# Check JWT
echo "🔐 JWT Configuration:"
if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "your_jwt_secret_here" ] && [ ${#JWT_SECRET} -ge 32 ]; then
    echo -e "   ${GREEN}✅${NC} JWT_SECRET configured (${#JWT_SECRET} chars)"
else
    echo -e "   ${RED}❌${NC} JWT_SECRET not set or too short (need 32+ chars)"
    echo "      Generate with: openssl rand -base64 32"
fi
echo ""

# Check ports
echo "🌐 Port Configuration:"
echo "   API_PORT: ${API_PORT:-3001}"
echo "   FRONTEND_PORT: ${FRONTEND_PORT:-3000}"

# Check if ports are available
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "   ${YELLOW}⚠️${NC}  Port 3001 already in use"
else
    echo -e "   ${GREEN}✅${NC} Port 3001 available"
fi

if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "   ${YELLOW}⚠️${NC}  Port 3000 already in use"
else
    echo -e "   ${GREEN}✅${NC} Port 3000 available"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Summary:"
echo ""

READY=true

if [ -z "$GITHUB_CLIENT_ID" ] || [ "$GITHUB_CLIENT_ID" = "your_github_client_id" ]; then
    echo -e "${RED}❌ Configure GitHub OAuth${NC}"
    READY=false
fi

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "postgresql://user:password@localhost:5432/cxdam" ]; then
    echo -e "${RED}❌ Configure DATABASE_URL${NC}"
    READY=false
fi

if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your_jwt_secret_here" ] || [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}❌ Configure JWT_SECRET${NC}"
    READY=false
fi

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ "$AWS_ACCESS_KEY_ID" = "your_access_key" ]; then
    echo -e "${YELLOW}⚠️  Configure AWS S3 (optional for login, required for uploads)${NC}"
fi

if [ "$READY" = true ]; then
    echo -e "${GREEN}✅ Ready to start! Run: npm run dev${NC}"
else
    echo -e "${RED}❌ Missing required configuration${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure missing values in .env"
    echo "2. Run database migrations: cd apps/backend && npm run migrate"
    echo "3. Start development: npm run dev"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
