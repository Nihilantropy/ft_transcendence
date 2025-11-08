# User Service Dockerfile (TypeScript)
FROM node:24.8.0-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:24.8.0-alpine

# Set working directory
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl

# Copy package files
COPY --from=builder /app/package*.json ./

# Copy node_modules from builder (includes compiled better-sqlite3)
COPY --from=builder /app/node_modules ./node_modules

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Use existing node user (UID 1000) to match database volume ownership
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Start server
CMD ["npm", "run", "dev"]
