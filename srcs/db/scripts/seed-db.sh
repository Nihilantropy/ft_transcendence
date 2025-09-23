#!/bin/bash
set -e

# # Load environment variables
# source /app/.env

DB_PATH="${DB_DIR}/${DB_FILE}"

echo "🌱 Starting database seeding..."

# Function to hash password (simple, will be improved with proper bcrypt later)
hash_password() {
    echo -n "$1" | sha256sum | cut -d' ' -f1
}

# Hash the admin password
DB_ADMIN_PASSWORD_HASH=$(hash_password "${DB_ADMIN_PASSWORD}")

# Apply role seeding
echo "🏷️ Seeding default roles..."
sqlite3 "${DB_PATH}" < /app/sql/02-seed-roles.sql

# Create admin user SQL from template with environment variable substitution
echo "👤 Creating database admin user..."
TEMP_ADMIN_SQL="/tmp/03-seed-admin.sql"
sed "s/{{DB_ADMIN_EMAIL}}/${DB_ADMIN_EMAIL}/g; s/{{DB_ADMIN_PASSWORD_HASH}}/${DB_ADMIN_PASSWORD_HASH}/g" \
    /app/sql/03-seed-admin.sql.template > "${TEMP_ADMIN_SQL}"

# Apply admin user seeding
sqlite3 "${DB_PATH}" < "${TEMP_ADMIN_SQL}"

# Apply user stats initialization
echo "📊 Initializing user statistics..."
sqlite3 "${DB_PATH}" < /app/sql/04-seed-user-stats.sql

# Clean up temporary file
rm -f "${TEMP_ADMIN_SQL}"

# Verify seeding
ROLE_COUNT=$(sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM roles;")
USER_COUNT=$(sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM users;")
USER_ROLE_COUNT=$(sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM user_roles;")
USER_STATS_COUNT=$(sqlite3 "${DB_PATH}" "SELECT COUNT(*) FROM user_stats;")

echo "📊 Seeding completed:"
echo "   • Roles created: ${ROLE_COUNT}"
echo "   • Users created: ${USER_COUNT}"  
echo "   • User-role assignments: ${USER_ROLE_COUNT}"
echo "   • User statistics initialized: ${USER_STATS_COUNT}"

# Display admin credentials (for development)
if [ "${NODE_ENV}" = "development" ]; then
    echo ""
    echo "🔐 Database Admin Credentials:"
    echo "   Email: ${DB_ADMIN_EMAIL}"
    echo "   Username: dbadmin"
    echo "   Password: ${DB_ADMIN_PASSWORD}"
    echo ""
fi

echo "✅ Database seeding completed successfully"