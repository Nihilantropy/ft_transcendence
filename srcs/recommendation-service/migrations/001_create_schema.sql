-- Create recommendation schema
CREATE SCHEMA IF NOT EXISTS recommendation_schema;

-- Grant permissions
GRANT USAGE ON SCHEMA recommendation_schema TO smartbreeds_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA recommendation_schema TO smartbreeds_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA recommendation_schema TO smartbreeds_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA recommendation_schema
GRANT ALL PRIVILEGES ON TABLES TO smartbreeds_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA recommendation_schema
GRANT ALL PRIVILEGES ON SEQUENCES TO smartbreeds_user;
