FROM keinos/sqlite3:3.50.4

# Switch to root to install packages and setup
USER root

# Install bash for better script support
RUN apk add --no-cache bash

# Create database directory
RUN mkdir -p /app/db-data && \
    chown -R 1000:1000 /app/db-data && \
    chmod -R 755 /app/db-data

# Copy environment file, database initialization scripts and SQL files
COPY scripts/ /app/scripts/
COPY sql/ /app/sql/
RUN chmod +x /app/scripts/*.sh && \
    chown -R 1000:1000 /app/scripts/ && \
    chown -R 1000:1000 /app/sql/

# Create an entrypoint script that handles permissions
RUN echo '#!/bin/bash' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo '# Fix permissions for the mounted volume' >> /app/entrypoint.sh && \
    echo 'chown -R 1000:1000 /app/db-data || true' >> /app/entrypoint.sh && \
    echo 'chmod -R 755 /app/db-data || true' >> /app/entrypoint.sh && \
    echo '# Switch to 1000 user and run init script' >> /app/entrypoint.sh && \
    echo 'exec su-exec 1000 /app/scripts/init-db.sh' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Install su-exec for user switching
RUN apk add --no-cache su-exec

# Stay as root for the entrypoint (will switch to sqlite user in the script)
USER root

# Set working directory
WORKDIR /app

# Run the entrypoint script that handles permissions and user switching
ENTRYPOINT ["/app/entrypoint.sh"]
