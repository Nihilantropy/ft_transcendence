# Stage 1: Builder
FROM node:24.8.0-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

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

EXPOSE 8001

CMD ["npm", "run", "dev"]
