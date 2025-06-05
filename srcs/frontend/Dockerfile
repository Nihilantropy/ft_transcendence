# ---------------------------------------------------------------------------- #
#                                 FRONTEND                                     #
# ---------------------------------------------------------------------------- #

FROM node:lts-alpine3.22

# Set working directory
WORKDIR /app

# Install dependencies for better container experience
RUN apk update && apk add --no-cache \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm i --only=production=false

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nextjs -u 1001 \
    && chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose Vite dev server port
EXPOSE 5173

# Health check to ensure service is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5173 || exit 1

# Start Vite development server
CMD ["npm", "run", "dev"]