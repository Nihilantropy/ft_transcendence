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
RUN npm ci

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

# Create non-root user
RUN addgroup -g 1000 -S appuser && \
    adduser -u 1000 -S appuser -G appuser

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Change ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Copy application code
COPY --chown=appuser:appuser . .

# Expose development server port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------------------------------------------------------------------------- #
#                               RUNNER-PROD                                    #
# ---------------------------------------------------------------------------- #

# Production stage
FROM nginx:1.25-alpine AS production

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# ---------------------------------------------------------------------------- #
#                                 DEFAULT                                      #
# ---------------------------------------------------------------------------- #

# Default to development stage
FROM development AS final