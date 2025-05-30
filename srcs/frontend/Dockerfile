# ---------------------------------------------------------------------------- #
#                                    BUILDER                                   #
# ---------------------------------------------------------------------------- #

FROM node:20-alpine AS builder

# Install build dependencies
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application for production
RUN npm run build

# ---------------------------------------------------------------------------- #
#                                DEVELOPMENT                                   #
# ---------------------------------------------------------------------------- #

FROM node:20-alpine AS development

# Install dependencies
RUN apk update && apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files and install all dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose development server port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------- #
#                                    DEFAULT                                   #
# ---------------------------------------------------------------------------- #

# Default to development for docker-compose
FROM development AS final