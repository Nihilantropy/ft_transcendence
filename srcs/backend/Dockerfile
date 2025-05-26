# ---------------------------------------------------------------------------- #
#                                   BUILDER                                    #
# ---------------------------------------------------------------------------- #

FROM node:20-alpine AS builder

# Install dependencies
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm i

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ---------------------------------------------------------------------------- #
#                                   RUNNER                                     #
# ---------------------------------------------------------------------------- #

FROM node:20-alpine AS runner

# Install only production dependencies
RUN apk update && apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
    adduser -u 1001 -S appuser -G appuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm i --omit=dev && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "dist/server.js"]