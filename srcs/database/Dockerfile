# ---------------------------------------------------------------------------- #
#                                    RUNNER                                    #
# ---------------------------------------------------------------------------- #

FROM alpine:3.19

# Install SQLite and utilities
RUN apk update && apk add --no-cache \
    sqlite \
    sqlite-dev \
    curl \
    bash \
    && rm -rf /var/cache/apk/*

# Create data directory
RUN mkdir -p /data

# Create non-root user
RUN addgroup -g 1000 -S dbuser && \
    adduser -u 1000 -S dbuser -G dbuser

# Set ownership
RUN chown -R dbuser:dbuser /data

# Switch to non-root user
USER dbuser

# Set working directory
WORKDIR /data

# Create initialization script
COPY --chown=dbuser:dbuser init-db.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-db.sh

# Volume for database persistence
VOLUME ["/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD sqlite3 /data/transcendence.db "SELECT 1;" || exit 1

# Run initialization and keep container running
CMD ["/usr/local/bin/init-db.sh"]