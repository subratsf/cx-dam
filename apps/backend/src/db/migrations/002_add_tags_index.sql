-- Migration to add GIN index on tags array for faster partial matching searches
-- This will significantly improve search performance when searching within tags

-- Create GIN index on tags array for faster array operations and ILIKE searches
-- GIN (Generalized Inverted Index) is ideal for array and full-text search operations
CREATE INDEX IF NOT EXISTS idx_assets_tags_gin ON assets USING GIN (tags);

-- Also create a standard index on the tags column for array overlap operations
CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets USING GIN (tags array_ops);
