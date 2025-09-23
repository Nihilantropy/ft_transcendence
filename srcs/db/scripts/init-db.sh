#!/bin/bash
set -e

# Database file path
DB_PATH="${DB_DIR}/${DB_FILE}"

echo "🗄️ Starting database initialization..."
echo "📂 Database directory: ${DB_DIR}"
echo "📄 Database file: ${DB_FILE}"
echo "🔗 Full path: ${DB_PATH}"
echo "👤 Current user: $(whoami)"
echo "📁 Directory permissions:"
ls -la "${DB_DIR}" 2>/dev/null || echo "Directory doesn't exist yet"

# Ensure database directory exists
mkdir -p "${DB_DIR}"
echo "✅ Database directory created/verified"

# Initialize database if it doesn't exist
if [ ! -f "${DB_PATH}" ]; then
    echo "📝 Creating new database: ${DB_PATH}"
    
    # Create database and apply schema
    echo "🏗️ Applying database schema..."
    if sqlite3 "${DB_PATH}" < /app/sql/01-schema.sql; then
        echo "✅ Database schema created successfully"
        # Run seeding script
        echo "🌱 Running database seeding..."
        /app/scripts/seed-db.sh
    else
        echo "❌ Failed to create database schema"
        exit 1
    fi
else
    echo "📂 Database already exists: ${DB_PATH}"
    echo "📁 Database file permissions:"
    ls -la "${DB_PATH}"
fi

echo "✅ Database initialization completed"

# Keep container running for database access
echo "🔄 Database service ready - exit 0"
exit 0