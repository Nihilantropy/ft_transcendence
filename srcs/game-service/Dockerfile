# Stage 1: Builder
FROM node:24.8.0-alpine AS builder

WORKDIR /app

# Install build dependencies (for better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:24.8.0-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY --from=builder /app/package*.json ./

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled code
COPY --from=builder /app/dist ./dist

# Create directory for database
RUN mkdir -p /app/db-data

# Use node user (UID 1000)
RUN chown -R node:node /app

USER node

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3003/health || exit 1

# Start server
CMD ["npm", "run", "dev"]
