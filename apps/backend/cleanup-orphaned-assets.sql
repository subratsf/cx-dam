-- Find orphaned assets (created but never confirmed, older than 1 hour)
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

-- Delete orphaned assets (uncomment to execute)
-- DELETE FROM assets 
-- WHERE state = 'Stage' 
--   AND created_at < NOW() - INTERVAL '1 hour';
