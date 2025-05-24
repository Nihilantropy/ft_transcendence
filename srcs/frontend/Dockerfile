# ---------------------------------------------------------------------------- #
#                                    BUILDER                                   #
# ---------------------------------------------------------------------------- #

FROM node:20-alpine AS builder

# Install dependencies
RUN apk update && apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the application
RUN npm run build

# ---------------------------------------------------------------------------- #
#                               RUNNER-DEV                                     #
# ---------------------------------------------------------------------------- #

# Development stage
FROM node:20-alpine AS development

# Install dependencies
RUN apk update && apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose development server port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------- #
#                                 DEFAULT                                      #
# ---------------------------------------------------------------------------- #

# Default to development stage
FROM development AS final