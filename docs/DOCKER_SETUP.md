# ft_transcendence Docker Setup

## Quick Start

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

2. Update `.env` with your values

3. Run the application:
   ```bash
   make
   ```
   or
   ```bash
   make up
   ```

## Available Commands

- `make up` - Start all services
- `make down` - Stop all services
- `make logs` - View logs
- `make restart` - Restart services
- `make clean` - Clean up containers
- `make fclean` - Full clean including images
- `make help` - Show all commands

## Architecture

- **nginx**: Reverse proxy with SSL termination
- **backend**: PHP backend (will migrate to Fastify)
- **frontend**: TypeScript SPA
- **database**: SQLite database

## Security Features

- HTTPS enabled with self-signed certificate
- Security headers configured
- Non-root containers
- Environment variables protection

## Development

Access the application at: https://localhost

API endpoints:
- https://localhost/api/health
- https://localhost/api/info

WebSocket endpoint:
- wss://localhost/ws
