-- Migration to add state and new metadata fields to assets table
-- Run this migration to update existing assets table

-- Add new columns to assets table
ALTER TABLE assets ADD COLUMN IF NOT EXISTS state VARCHAR(50) NOT NULL DEFAULT 'Stage';
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS modified_by UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS modified_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Backfill created_by with uploaded_by for existing records
UPDATE assets SET created_by = uploaded_by WHERE created_by IS NULL;

-- Backfill created_on with created_at for existing records
UPDATE assets SET created_on = created_at WHERE created_on IS NULL;

-- Make created_by NOT NULL after backfilling
ALTER TABLE assets ALTER COLUMN created_by SET NOT NULL;

-- Add foreign key constraint for created_by
ALTER TABLE assets ADD CONSTRAINT fk_assets_created_by
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

-- Add foreign key constraint for modified_by
ALTER TABLE assets ADD CONSTRAINT fk_assets_modified_by
  FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_assets_state ON assets(state);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON assets(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_on ON assets(created_on DESC);

-- Drop old trigger and recreate to update modified_on
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;

CREATE OR REPLACE FUNCTION update_assets_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.modified_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assets_timestamps
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_assets_timestamps();
