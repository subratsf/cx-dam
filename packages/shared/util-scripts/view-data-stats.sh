#!/bin/bash

# View statistics about database data

set -e

echo "📊 Database Statistics"
echo "===================="
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

echo "📦 Total Records:"
psql "$DATABASE_URL" -c "
SELECT 'Assets' as table_name, COUNT(*) as count FROM assets
UNION ALL
SELECT 'Bloom Filters', COUNT(*) FROM bloom_filter_state
UNION ALL
SELECT 'Users', COUNT(*) FROM users;
"

echo ""
echo "📁 Assets by Workspace:"
psql "$DATABASE_URL" -c "
SELECT 
  workspace, 
  COUNT(*) as count,
  COUNT(CASE WHEN state = 'Stage' THEN 1 END) as stage_count,
  COUNT(CASE WHEN state != 'Stage' THEN 1 END) as confirmed_count
FROM assets 
GROUP BY workspace
ORDER BY count DESC;
"

echo ""
echo "🏷️  Assets by File Type:"
psql "$DATABASE_URL" -c "
SELECT 
  file_type, 
  COUNT(*) as count
FROM assets 
GROUP BY file_type
ORDER BY count DESC;
"

echo ""
echo "⏰ Orphaned Assets (Stage state, older than 1 hour):"
psql "$DATABASE_URL" -c "
SELECT 
  COUNT(*) as orphaned_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM assets 
WHERE state = 'Stage' 
  AND created_at < NOW() - INTERVAL '1 hour';
"

echo ""
echo "🌸 Bloom Filters by Workspace:"
psql "$DATABASE_URL" -c "
SELECT workspace, COUNT(*) as filter_count
FROM bloom_filter_state
GROUP BY workspace
ORDER BY filter_count DESC;
"

echo ""
echo "✅ Statistics complete!"
