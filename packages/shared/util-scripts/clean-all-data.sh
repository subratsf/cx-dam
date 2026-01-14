#!/bin/bash

# Clean all data from the database (assets and bloom filter)
# WARNING: This will delete ALL assets and bloom filter data!

set -e

echo "⚠️  WARNING: This will delete ALL data from assets and bloom_filters tables!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Aborted."
  exit 0
fi

echo ""
echo "🧹 Cleaning all data from database..."
echo ""

# Get DATABASE_URL from environment or .env file
if [ -z "$DATABASE_URL" ]; then
  # Try root .env
  if [ -f "../../.env" ]; then
    export $(grep DATABASE_URL ../../.env | xargs)
  elif [ -f ".env" ]; then
    export $(grep DATABASE_URL .env | xargs)
  else
    echo "❌ DATABASE_URL not found in environment or .env file"
    exit 1
  fi
fi

echo "📊 Current data count:"
psql "$DATABASE_URL" -c "SELECT 'Assets' as table_name, COUNT(*) as count FROM assets UNION ALL SELECT 'Bloom Filters', COUNT(*) FROM bloom_filter_state;"

echo ""
echo "🗑️  Deleting all assets..."
psql "$DATABASE_URL" -c "DELETE FROM assets;"

echo ""
echo "🗑️  Deleting all bloom filters..."
psql "$DATABASE_URL" -c "DELETE FROM bloom_filter_state;"

echo ""
echo "📊 Final data count:"
psql "$DATABASE_URL" -c "SELECT 'Assets' as table_name, COUNT(*) as count FROM assets UNION ALL SELECT 'Bloom Filters', COUNT(*) FROM bloom_filter_state;"

echo ""
echo "✅ All data cleaned successfully!"
