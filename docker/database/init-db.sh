#!/bin/bash

# Database file path
DB_FILE="/data/transcendence.db"

# Check if database exists
if [ ! -f "$DB_FILE" ]; then
    echo "Initializing SQLite database..."
    
    # Create database and initial schema
    sqlite3 "$DB_FILE" <<EOF
-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(255),
    is_online BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_id INTEGER NOT NULL,
    player2_id INTEGER NOT NULL,
    winner_id INTEGER,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    game_type VARCHAR(50) DEFAULT 'pong',
    status VARCHAR(20) DEFAULT 'pending',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
);

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    max_players INTEGER DEFAULT 8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

-- Tournament participants table
CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER,
    alias VARCHAR(50) NOT NULL,
    position INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Friends table
CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id),
    UNIQUE(user_id, friend_id)
);

-- Create indexes for performance
CREATE INDEX idx_games_players ON games(player1_id, player2_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_tournament_participants ON tournament_participants(tournament_id, user_id);
CREATE INDEX idx_friends_users ON friends(user_id, friend_id);

-- Insert test data (optional, remove in production)
INSERT INTO users (username, email, password_hash, display_name) 
VALUES ('testuser', 'test@example.com', 'hashed_password_here', 'Test User');

EOF
    
    echo "Database initialized successfully!"
else
    echo "Database already exists at $DB_FILE"
fi

# Keep the container running and periodically check database health
while true; do
    sleep 30
    sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" > /dev/null 2>&1
    if [ $? -ne 0 ]; then
        echo "Database health check failed!"
        exit 1
    fi
done