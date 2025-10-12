# 🗄️ ft_transcendence Database Configuration

## Overview

This document defines the essential database schema for the ft_transcendence Pong application, focusing on user management and role-based access control.

## 🔑 Roles Table

### Purpose
Define user permission levels for application security and access control. In ft_transcendence, permissions are handled by assigning a single role to each user. The application logic checks the user's role to determine access.

### Essential Roles
- **`user`** - Standard player (can play games, manage profile, add friends)
- **`moderator`** - Can moderate games and user interactions (everything user can do, plus moderation)
- **`app_admin`** - Full application administration privileges (everything moderator can do, plus user management)
- **`db_admin`** - Database management and maintenance access (database only, not app features)

### Table Structure
```sql
CREATE TABLE roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL, -- 'user', 'moderator', 'app_admin', 'db_admin'
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Permission Handling
- No complex permission schema or JSON field.
- Application code checks the user's role (e.g., `if (user.role === 'moderator')`).
- All permissions are defined by role name only.

**Example usage:**
```js
if (user.role === 'app_admin') {
    // Allow admin actions
}
```

## 👤 Users Table

### Purpose
Store essential user data required for authentication, profile management, and game functionality.

### Required Fields (based on Frontend API)

#### Core Authentication
- **`id`** - Unique user identifier
- **`username`** - Unique game display name
- **`email`** - Authentication and communication
- **`password_hash`** - Secure password storage

#### Profile Information  
- **`avatar_url`** - Profile picture URL
- **`is_online`** - Current online status
- **`last_seen`** - Last activity timestamp

#### Account Management
- **`is_active`** - Account enabled/disabled status
- **`email_verified`** - Email verification status
- **`email_verification_token`** - Verification token
- **`password_reset_token`** - Password reset token
- **`password_reset_expires`** - Reset token expiration

#### OAuth Integration
- **`google_id`** - Google OAuth identifier
- **`oauth_providers`** - JSON array of linked providers

#### Two-Factor Authentication
- **`two_factor_enabled`** - 2FA status
- **`two_factor_secret`** - TOTP secret key
- **`backup_codes`** - JSON array of backup codes

#### Timestamps
- **`created_at`** - Account creation
- **`updated_at`** - Last profile modification

### Table Structure
```sql
CREATE TABLE users (
    -- Core Identity
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    
    -- Authentication
    password_hash TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token TEXT,
    password_reset_token TEXT,
    password_reset_expires DATETIME,
    
    -- Profile
    avatar_url TEXT,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_online BOOLEAN DEFAULT FALSE,
    last_seen DATETIME,
    
    -- OAuth
    google_id TEXT UNIQUE,
    oauth_providers TEXT, -- JSON array: ["google", "github"]
    
    -- Two-Factor Auth
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT, -- JSON array of backup codes
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Indexes
```sql
-- Performance optimization
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_is_online ON users(is_online);
CREATE INDEX idx_users_last_seen ON users(last_seen);

-- Security lookups
CREATE INDEX idx_users_email_verification ON users(email_verification_token);
CREATE INDEX idx_users_password_reset ON users(password_reset_token);
```

## 🔗 User-Role Relationships

### Table Structure
```sql
CREATE TABLE user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER, -- Admin who granted the role
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id),
    UNIQUE(user_id, role_id)
);
```

## 📋 Data Constraints

### Username Rules
- Length: 3-20 characters
- Allowed: alphanumeric, underscore, hyphen
- Case-insensitive uniqueness
- No profanity or reserved words

### Email Rules
- Valid email format
- Case-insensitive uniqueness
- Required for account recovery

### Password Requirements
- Minimum 8 characters
- Stored as bcrypt hash
- Reset tokens expire in 1 hour

### Avatar Rules
- Max file size: 2MB
- Formats: JPG, PNG, WebP
- Auto-resize to 256x256px

## 🛡️ Security Considerations

### Password Security
- Use bcrypt with salt rounds ≥ 12
- Implement rate limiting on auth endpoints
- Require strong passwords (complexity rules) # Done in the frontend

### Token Management
- Email verification tokens: 24-hour expiry
- Password reset tokens: 1-hour expiry
- JWT tokens: 15-minute access, 7-day refresh

### Privacy
- Never expose password hashes in API responses
- Log authentication events for security monitoring
- Implement GDPR-compliant data deletion

##  Friends & Social System

### Purpose
Handle friend requests, friendships, and user blocking functionality with clear separation of concerns.

### Friend Requests Table
```sql
CREATE TABLE friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    message TEXT, -- Optional message with friend request
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    
    FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(from_user_id, to_user_id)
);
```

### Friendships Table
```sql
CREATE TABLE friendships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, friend_id)
);
```

### Blocked Users Table
```sql
CREATE TABLE blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,        -- Who blocked
    blocked_user_id INTEGER NOT NULL, -- Who was blocked
    reason TEXT,                     -- Optional reason for blocking
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, blocked_user_id)
);
```

### Social System Indexes
```sql
-- Friend requests optimization
CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX idx_friend_requests_to_user ON friend_requests(to_user_id);
CREATE INDEX idx_friend_requests_status ON friend_requests(status);

-- Friendships optimization
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);

-- Blocked users optimization
CREATE INDEX idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX idx_blocked_users_blocked_id ON blocked_users(blocked_user_id);
```

### Social System Logic

#### Friend Request Flow
1. User A sends request to User B → Insert into `friend_requests`
2. User B accepts → Insert bidirectional entries into `friendships`, update request status
3. User B declines → Update request status only

#### Friendship Queries
- **Get all friends**: Query `friendships` where `user_id = current_user`
- **Check if friends**: Look for entry in `friendships` table
- **Remove friend**: Delete both bidirectional entries from `friendships`

#### Blocking Logic
- **Block user**: Insert into `blocked_users`, remove any existing friendship
- **Check if blocked**: Query `blocked_users` table
- **Blocked users cannot**: Send friend requests, see user online, join same games

## 🎮 Game System

### Purpose
Track game sessions, match history, and player statistics for the Pong application.

### Games Table
```sql
CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'classic', 'tournament', 'ai'
    status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'finished', 'cancelled'
    player1_id INTEGER NOT NULL,
    player2_id INTEGER, -- NULL for AI games
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    winner_id INTEGER, -- NULL if no winner yet
    settings TEXT, -- JSON for game settings (ball speed, paddle size, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    finished_at DATETIME,
    
    FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
);
```

### User Statistics Table
```sql
CREATE TABLE user_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    win_rate REAL DEFAULT 0.0, -- Calculated field (games_won / games_played)
    total_score INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    ranking INTEGER DEFAULT 0,
    tournaments_played INTEGER DEFAULT 0,
    tournaments_won INTEGER DEFAULT 0,
    average_game_duration INTEGER DEFAULT 0, -- In seconds
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Game System Indexes
```sql
-- Games optimization
CREATE INDEX idx_games_player1 ON games(player1_id);
CREATE INDEX idx_games_player2 ON games(player2_id);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_type ON games(type);
CREATE INDEX idx_games_finished_at ON games(finished_at);

-- User statistics optimization
CREATE INDEX idx_user_stats_user_id ON user_stats(user_id);
CREATE INDEX idx_user_stats_ranking ON user_stats(ranking);
CREATE INDEX idx_user_stats_games_won ON user_stats(games_won);
CREATE INDEX idx_user_stats_win_rate ON user_stats(win_rate);
CREATE INDEX idx_user_stats_tournaments_won ON user_stats(tournaments_won);
CREATE INDEX idx_user_stats_ranking ON user_stats(ranking);
CREATE INDEX idx_user_stats_games_won ON user_stats(games_won);
```

## 🏆 Tournament System

### Purpose
Manage tournament creation, brackets, and progression.

### Tournaments Table
```sql
CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    max_participants INTEGER NOT NULL,
    status TEXT DEFAULT 'registration', -- 'registration', 'in_progress', 'finished'
    created_by INTEGER NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);
```

### Tournament Participants Table
```sql
CREATE TABLE tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    eliminated_at DATETIME,
    final_position INTEGER,
    
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(tournament_id, user_id)
);

---

*Last Updated: September 18, 2025*  
*Schema Version: 1.0*