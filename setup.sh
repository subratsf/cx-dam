#!/bin/bash

set -e

echo "🚀 Setting up CX DAM..."
echo ""

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Error: Node.js 20 or higher is required. Current version: $(node -v)"
  exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Copy env file if it doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo "✅ Created .env file - PLEASE CONFIGURE IT!"
  echo "   You need to set:"
  echo "   - GitHub OAuth credentials"
  echo "   - Database URL"
  echo "   - AWS S3 credentials"
  echo "   - JWT secret"
  echo ""
else
  echo "ℹ️  .env already exists"
  echo ""
fi

# Build packages
echo "🔨 Building packages..."
npm run build
echo "✅ Build complete"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  NEXT STEPS:"
echo ""
echo "1. Configure GitHub OAuth app:"
echo "   → https://github.com/settings/developers"
echo "   → Application name: CX DAM Local"
echo "   → Homepage URL: http://localhost:3000"
echo "   → Callback URL: http://localhost:3001/api/auth/github/callback"
echo ""
echo "2. Create PostgreSQL database:"
echo "   → createdb cxdam"
echo ""
echo "3. Update .env with your credentials"
echo ""
echo "4. Run database migrations:"
echo "   → cd apps/backend && npm run migrate"
echo ""
echo "5. Start development servers:"
echo "   → npm run dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
