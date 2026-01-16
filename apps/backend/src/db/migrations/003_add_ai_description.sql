-- Add AI-generated description column for semantic search
ALTER TABLE assets
ADD COLUMN IF NOT EXISTS ai_description TEXT;

-- Add index for text search on AI description
CREATE INDEX IF NOT EXISTS idx_assets_ai_description_gin
ON assets USING gin(to_tsvector('english', COALESCE(ai_description, '')));

-- Comment
COMMENT ON COLUMN assets.ai_description IS 'AI-generated image description for semantic search';
