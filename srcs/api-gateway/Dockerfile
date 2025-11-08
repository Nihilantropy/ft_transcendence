# API Gateway Dockerfile
FROM node:24.8.0-alpine

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY src ./src

# Use existing node user (UID 1000) to match other services
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start server
CMD ["node", "src/server.js"]
