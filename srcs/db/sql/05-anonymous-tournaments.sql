-- Migration: Support Anonymous Tournament Participation
-- Purpose: Allow users to participate in tournaments without authentication
-- Date: 2025-01-07
-- Requirement: Subject page 9-10 - "The tournament system must work with or without user registration"

-- ==============================================================================
-- STEP 1: Modify tournaments table to support anonymous creation
-- ==============================================================================

-- SQLite doesn't support ALTER COLUMN directly, so we need to recreate the table
-- First, create a backup of existing tournaments
CREATE TABLE IF NOT EXISTS tournaments_backup AS SELECT * FROM tournaments;

-- Drop the old tournaments table
DROP TABLE IF EXISTS tournaments;

-- Recreate tournaments table with nullable created_by
CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    max_participants INTEGER NOT NULL,
    status TEXT DEFAULT 'registration', -- 'registration', 'in_progress', 'finished'
    created_by INTEGER,  -- NOW NULLABLE for anonymous tournament creation
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Restore data from backup
INSERT INTO tournaments
SELECT * FROM tournaments_backup;

-- Drop backup table
DROP TABLE tournaments_backup;

-- ==============================================================================
-- STEP 2: Modify tournament_participants table to support anonymous players
-- ==============================================================================

-- Create backup of existing participants
CREATE TABLE IF NOT EXISTS tournament_participants_backup AS SELECT * FROM tournament_participants;

-- Drop the old tournament_participants table
DROP TABLE IF EXISTS tournament_participants;

-- Recreate tournament_participants with proper anonymous support
CREATE TABLE tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER,  -- NOW NULLABLE for anonymous participants
    alias TEXT NOT NULL,  -- REQUIRED: Player alias for the tournament
    session_id TEXT,  -- Session identifier for anonymous users
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    eliminated_at DATETIME,
    final_position INTEGER,

    -- Foreign keys
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    -- Constraints
    -- For authenticated users: prevent duplicate entries
    UNIQUE(tournament_id, user_id) ON CONFLICT FAIL,
    -- For anonymous users: prevent duplicate aliases in same tournament
    CHECK (
        (user_id IS NOT NULL) OR
        (user_id IS NULL AND session_id IS NOT NULL)
    )
);

-- Restore data from backup (with alias set to username for existing participants)
INSERT INTO tournament_participants (id, tournament_id, user_id, alias, joined_at, eliminated_at, final_position)
SELECT
    tp.id,
    tp.tournament_id,
    tp.user_id,
    COALESCE(u.username, 'Player' || tp.user_id) as alias,  -- Use username or generate alias
    tp.joined_at,
    tp.eliminated_at,
    tp.final_position
FROM tournament_participants_backup tp
LEFT JOIN users u ON tp.user_id = u.id;

-- Drop backup table
DROP TABLE tournament_participants_backup;

-- ==============================================================================
-- STEP 3: Create indexes for performance
-- ==============================================================================

-- Index for looking up participants by tournament
CREATE INDEX idx_tournament_participants_tournament_id
ON tournament_participants(tournament_id);

-- Index for looking up participants by user (authenticated players)
CREATE INDEX idx_tournament_participants_user_id
ON tournament_participants(user_id)
WHERE user_id IS NOT NULL;

-- Index for looking up participants by session (anonymous players)
CREATE INDEX idx_tournament_participants_session_id
ON tournament_participants(session_id)
WHERE session_id IS NOT NULL;

-- Index for preventing duplicate aliases per tournament
CREATE UNIQUE INDEX idx_tournament_participants_alias_unique
ON tournament_participants(tournament_id, LOWER(alias));

-- ==============================================================================
-- STEP 4: Create view for easy participant lookup
-- ==============================================================================

-- View that combines authenticated and anonymous participant data
CREATE VIEW IF NOT EXISTS v_tournament_participants AS
SELECT
    tp.id,
    tp.tournament_id,
    tp.user_id,
    tp.alias,
    tp.session_id,
    tp.joined_at,
    tp.eliminated_at,
    tp.final_position,
    -- User data (if authenticated)
    u.username,
    u.email,
    -- Participant type flag
    CASE
        WHEN tp.user_id IS NOT NULL THEN 'authenticated'
        ELSE 'anonymous'
    END as participant_type
FROM tournament_participants tp
LEFT JOIN users u ON tp.user_id = u.id;

-- ==============================================================================
-- Migration complete
-- ==============================================================================

-- Verification queries (commented out for production)
-- SELECT COUNT(*) as total_tournaments FROM tournaments;
-- SELECT COUNT(*) as total_participants FROM tournament_participants;
-- SELECT * FROM v_tournament_participants LIMIT 5;
