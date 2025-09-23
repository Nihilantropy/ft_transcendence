-- ft_transcendence Database Seed Data
-- Version: 2.0
-- Description: Updated seed data for roles (simplified permission system)

-- Insert default roles (simplified - no JSON permissions)
INSERT OR IGNORE INTO roles (name, description) VALUES 
    ('user', 'Standard player (can play games, manage profile, add friends)'),
    ('moderator', 'Can moderate games and user interactions (everything user can do, plus moderation)'),
    ('app_admin', 'Full application administration privileges (everything moderator can do, plus user management)'),
    ('db_admin', 'Database management and maintenance access (database only, not app features)');