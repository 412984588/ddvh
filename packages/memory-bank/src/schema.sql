-- Memory Bank Database Schema
-- SQLite database for storing pitfalls, successful patterns, and task history

-- Pitfalls: Common errors and their solutions
CREATE TABLE IF NOT EXISTS pitfalls (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  symptoms TEXT NOT NULL, -- JSON array
  solution TEXT NOT NULL,
  keywords TEXT NOT NULL, -- JSON array
  severity TEXT NOT NULL CHECK(severity IN ('low', 'medium', 'high')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  occurrence_count INTEGER DEFAULT 1
);

-- Successful patterns: Approaches that worked well
CREATE TABLE IF NOT EXISTS successful_patterns (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  approach TEXT NOT NULL,
  keywords TEXT NOT NULL, -- JSON array
  effectiveness REAL DEFAULT 0.5,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  use_count INTEGER DEFAULT 1
);

-- Task runs: History of dispatched tasks
CREATE TABLE IF NOT EXISTS task_runs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  prompt TEXT NOT NULL,
  result TEXT,
  error TEXT,
  duration INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  created_at INTEGER NOT NULL,
  pitfall_ids TEXT, -- JSON array of related pitfalls
  pattern_ids TEXT -- JSON array of related patterns
);

-- Task keywords: For fuzzy search without FTS5
CREATE TABLE IF NOT EXISTS task_keywords (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES task_runs(id) ON DELETE CASCADE
);

-- Pitfall keyword index
CREATE TABLE IF NOT EXISTS pitfall_keyword_index (
  pitfall_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  FOREIGN KEY (pitfall_id) REFERENCES pitfalls(id) ON DELETE CASCADE
);

-- Pattern keyword index
CREATE TABLE IF NOT EXISTS pattern_keyword_index (
  pattern_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  FOREIGN KEY (pattern_id) REFERENCES successful_patterns(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_pitfalls_category ON pitfalls(category);
CREATE INDEX IF NOT EXISTS idx_pitfalls_severity ON pitfalls(severity);
CREATE INDEX IF NOT EXISTS idx_pitfalls_created ON pitfalls(created_at);
CREATE INDEX IF NOT EXISTS idx_patterns_category ON successful_patterns(category);
CREATE INDEX IF NOT EXISTS idx_patterns_effectiveness ON successful_patterns(effectiveness);
CREATE INDEX IF NOT EXISTS idx_task_runs_session ON task_runs(session_id);
CREATE INDEX IF NOT EXISTS idx_task_runs_intent ON task_runs(intent);
CREATE INDEX IF NOT EXISTS idx_task_runs_created ON task_runs(created_at);
CREATE INDEX IF NOT EXISTS idx_task_keywords_keyword ON task_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_pitfall_keyword_keyword ON pitfall_keyword_index(keyword);
CREATE INDEX IF NOT EXISTS idx_pattern_keyword_keyword ON pattern_keyword_index(keyword);
