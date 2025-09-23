-- ft_transcendence Database User Stats Initialization
-- Version: 2.0
-- Description: Initialize user statistics for existing users

-- Create default statistics entry for users who don't have one yet
-- This ensures every user has a user_stats record
INSERT OR IGNORE INTO user_stats (user_id)
SELECT id FROM users 
WHERE id NOT IN (SELECT user_id FROM user_stats WHERE user_id IS NOT NULL);