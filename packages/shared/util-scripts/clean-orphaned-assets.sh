#!/bin/bash

# Cleanup orphaned assets from the database
# This script removes asset records in 'Stage' state that are older than 1 hour

set -e

echo "🧹 Cleaning up orphaned asset records..."
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

echo "📊 Finding orphaned assets (Stage state, older than 1 hour)..."
psql "$DATABASE_URL" -c "
SELECT 
  id, 
  name, 
  workspace, 
  state,
  created_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))/60 as age_minutes
FROM assets 
WHERE state = 'Stage' 
  AND created_at < NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
"

# Count orphaned records
count=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM assets WHERE state = 'Stage' AND created_at < NOW() - INTERVAL '1 hour';")
count=$(echo "$count" | xargs) # trim whitespace

if [ "$count" -eq 0 ]; then
  echo ""
  echo "✅ No orphaned records found!"
  exit 0
fi

echo ""
echo "Found $count orphaned record(s)"
read -p "Delete these records? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Aborted."
  exit 0
fi

echo ""
echo "🗑️  Deleting orphaned records..."
psql "$DATABASE_URL" -c "
DELETE FROM assets 
WHERE state = 'Stage' 
  AND created_at < NOW() - INTERVAL '1 hour';
"

echo ""
echo "✅ Cleanup complete! Deleted $count record(s)."
