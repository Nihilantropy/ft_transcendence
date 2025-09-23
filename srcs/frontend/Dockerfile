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

# Change ownership to non-root user
RUN chown -R 1000:1000 /app

# Switch to non-root user
USER 1000

# Expose Vite dev server port
EXPOSE 5173

# Start Vite development server
CMD ["npm", "run", "dev"]