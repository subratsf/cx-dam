-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id INTEGER UNIQUE NOT NULL,
    login VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    workspace VARCHAR(255) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    s3_key TEXT NOT NULL,
    s3_bucket VARCHAR(255) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_name_per_workspace UNIQUE (name, workspace)
);

-- Bloom filter state table (for persistence)
CREATE TABLE IF NOT EXISTS bloom_filter_state (
    id SERIAL PRIMARY KEY,
    workspace VARCHAR(255) NOT NULL UNIQUE,
    bit_array BYTEA NOT NULL,
    size INTEGER NOT NULL,
    hash_count INTEGER NOT NULL,
    items_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assets_workspace ON assets(workspace);
CREATE INDEX IF NOT EXISTS idx_assets_name ON assets(name);
CREATE INDEX IF NOT EXISTS idx_assets_tags ON assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_assets_file_type ON assets(file_type);
CREATE INDEX IF NOT EXISTS idx_assets_uploaded_by ON assets(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

-- Full-text search index for asset names
CREATE INDEX IF NOT EXISTS idx_assets_name_fts ON assets USING gin(to_tsvector('english', name));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
