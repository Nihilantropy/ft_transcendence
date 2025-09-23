# Database SQL Files

This directory contains the official SQL files used for database initialization and seeding.

## File Structure

### Schema Files
- **`01-schema.sql`**: Complete database schema definition (Version 2.0)
  - Creates all tables with proper constraints and indexes
  - Includes schema versioning table
  - Sets up foreign key relationships
  - **All Tables**: users, roles, user_roles, friend_requests, friendships, blocked_users, games, user_stats, tournaments, tournament_participants

### Seed Data Files
- **`02-seed-roles.sql`**: Default role definitions (Version 2.0)
  - Creates standard user roles (user, moderator, app_admin, db_admin)
  - Simplified role system without JSON permissions

- **`03-seed-admin.sql.template`**: Database admin user template
  - Template file for creating the database admin user
  - Uses placeholders for environment variable substitution
  - Assigns db_admin role to the admin user

- **`04-seed-user-stats.sql`**: User statistics initialization
  - Creates default statistics entries for existing users
  - Ensures every user has a user_stats record

## Usage

These SQL files are executed by the database initialization scripts:

1. **Schema Creation**: `sqlite3 database.db < 01-schema.sql`
2. **Role Seeding**: `sqlite3 database.db < 02-seed-roles.sql`
3. **Admin User**: Environment variables are substituted into the template, then executed
4. **User Stats**: `sqlite3 database.db < 04-seed-user-stats.sql`

## Environment Variable Substitution

The `03-seed-admin.sql.template` file uses the following placeholders:
- `{{DB_ADMIN_EMAIL}}` - Replaced with the admin email from .env
- `{{DB_ADMIN_PASSWORD_HASH}}` - Replaced with the hashed admin password

## Complete Database Schema

### Core Tables
- **users**: Complete user profiles with auth, OAuth, 2FA
- **roles**: Simple role-based permissions (user, moderator, app_admin, db_admin)
- **user_roles**: User-role assignments

### Social System
- **friend_requests**: Friend request management
- **friendships**: Accepted friendships (bidirectional)
- **blocked_users**: User blocking system

### Game System  
- **games**: Game sessions and match tracking
- **user_stats**: Player statistics and rankings
- **tournaments**: Tournament management
- **tournament_participants**: Tournament participation tracking

## Benefits

- **Version Control**: SQL files can be properly tracked and versioned
- **Readability**: Clear SQL syntax without shell heredoc escaping
- **Maintainability**: Easy to modify schema and seed data
- **Testability**: SQL files can be tested independently
- **IDE Support**: Proper SQL syntax highlighting and validation
- **Complete Schema**: All tables needed for full ft_transcendence functionality