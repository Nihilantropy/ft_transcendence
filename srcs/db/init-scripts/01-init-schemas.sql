-- Initialize database schemas for SmartBreeds microservices
-- This script runs automatically when PostgreSQL container starts

\c smartbreeds;

-- Create auth schema (owned by smartbreeds_user)
CREATE SCHEMA IF NOT EXISTS auth_schema AUTHORIZATION smartbreeds_user;

-- Create user schema (for future user-service)
CREATE SCHEMA IF NOT EXISTS user_schema AUTHORIZATION smartbreeds_user;

-- Create ai schema (for future ai-service)
CREATE SCHEMA IF NOT EXISTS ai_schema AUTHORIZATION smartbreeds_user;

-- Grant privileges
GRANT ALL PRIVILEGES ON SCHEMA auth_schema TO smartbreeds_user;
GRANT ALL PRIVILEGES ON SCHEMA user_schema TO smartbreeds_user;
GRANT ALL PRIVILEGES ON SCHEMA ai_schema TO smartbreeds_user;

-- Set search path for smartbreeds_user
ALTER ROLE smartbreeds_user SET search_path TO auth_schema, user_schema, ai_schema, public;

-- Create test database for pytest
CREATE DATABASE test_smartbreeds OWNER smartbreeds_user;

\c test_smartbreeds;

-- Create schemas in test database
CREATE SCHEMA IF NOT EXISTS auth_schema AUTHORIZATION smartbreeds_user;
CREATE SCHEMA IF NOT EXISTS user_schema AUTHORIZATION smartbreeds_user;
CREATE SCHEMA IF NOT EXISTS ai_schema AUTHORIZATION smartbreeds_user;

GRANT ALL PRIVILEGES ON SCHEMA auth_schema TO smartbreeds_user;
GRANT ALL PRIVILEGES ON SCHEMA user_schema TO smartbreeds_user;
GRANT ALL PRIVILEGES ON SCHEMA ai_schema TO smartbreeds_user;

ALTER ROLE smartbreeds_user SET search_path TO auth_schema, user_schema, ai_schema, public;
