# ---------------------------------------------------------------------------- #
#                                 RUNNER-PHP                                   #
# ---------------------------------------------------------------------------- #

# Multi-stage Dockerfile to support both PHP (mandatory) and Node.js (modules)
FROM php:8.2-fpm-alpine AS php-backend

# Install PHP extensions and dependencies
RUN apk update && apk add --no-cache \
    postgresql-dev \
    sqlite-dev \
    curl \
    zip \
    unzip \
    git \
    && docker-php-ext-install pdo pdo_pgsql pdo_sqlite \
    && rm -rf /var/cache/apk/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy PHP configuration
COPY php.ini /usr/local/etc/php/conf.d/custom.ini

# Create non-root user
RUN addgroup -g 1000 -S appuser && \
    adduser -u 1000 -S appuser -G appuser

# Change ownership
RUN chown -R appuser:appuser /app

USER appuser

# Expose PHP-FPM port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD php-fpm -t || exit 1

CMD ["php-fpm"]

# ---------------------------------------------------------------------------- #
#                                 RUNNER-NODEJS                                #
# ---------------------------------------------------------------------------- #

# Node.js backend stage (for future Fastify implementation)
FROM node:20-alpine AS node-backend

# Install dependencies
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1000 -S appuser && \
    adduser -u 1000 -S appuser -G appuser

# Copy package files
COPY package*.json ./

# Install dependencies as root
RUN npm ci --only=production

# Change ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Copy application code
COPY --chown=appuser:appuser . .

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "server.js"]

# ---------------------------------------------------------------------------- #
#                                 DEFAULT                                      #
# ---------------------------------------------------------------------------- #

# Default to PHP for mandatory requirements
FROM php-backend AS final