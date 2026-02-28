CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'r2',
  content_type TEXT,
  size INTEGER,
  ext TEXT,
  list_type TEXT NOT NULL DEFAULT 'None',
  label TEXT NOT NULL DEFAULT 'None',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
