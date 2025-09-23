# Backend Dockerfile for ft_transcendence
# Using Node.js 24.8.0 on Alpine Linux 3.22 for optimal performance and security

FROM node:24.8.0-alpine3.22

# Set working directory
WORKDIR /app

# Copy package.json for dependency installation
COPY package*.json ./

# Install npm packages
RUN npm i --only=production=false

# Copy source code
COPY . .

# Change ownership to non-root user
RUN chown -R 1000:1000 /app
USER 1000

# Expose port 8000 for the backend API
EXPOSE 8000

# Run in development mode
CMD ["npm", "run", "dev"]