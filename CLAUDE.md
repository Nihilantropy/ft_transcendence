# ft_transcendence - Architecture & Development Guide

## Project Overview

**ft_transcendence** is a modern, real-time multiplayer Pong game web application with advanced features including tournaments, friend systems, authentication, and live notifications.

**Tech Stack Summary:**
- **Backend:** Node.js + Fastify + Socket.IO
- **Frontend:** TypeScript + Vite + TailwindCSS
- **Database:** SQLite (better-sqlite3)
- **Reverse Proxy:** Nginx (with SSL/TLS)
- **Containerization:** Docker & Docker Compose

---

## 1. High-Level Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (Reverse Proxy)                   │
│              Ports: 8000 (HTTP→HTTPS), 4433 (HTTPS)             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Frontend (Vite Dev Server)                    │  │
│  │  • TypeScript + TailwindCSS                              │  │
│  │  • Port 5173 (internal) → 443 (nginx proxy)              │  │
│  │  • Single Page Application (SPA) with Client Router      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            Backend API (Fastify Server)                  │  │
│  │  • Port 8000                                             │  │
│  │  • REST API endpoints at /api/*                          │  │
│  │  • Socket.IO WebSocket on /socket.io/                   │  │
│  │  • Swagger docs at /api/documentation                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           ↓                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            SQLite Database                               │  │
│  │  • File-based: /app/db-data/ft_transcendence.db          │  │
│  │  • Initialized by db container                           │  │
│  │  • Shared volume: db-data (Docker)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            SQLite Browser (Debug Tool)                   │  │
│  │  • Port 3000-3001 for database inspection                │  │
│  │  • Development only                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **Client → Nginx**: Browser connects to `https://localhost:4433`
2. **Nginx → Frontend**: Routes to Vite dev server via HTTP proxy
3. **Frontend → Backend**: 
   - REST API calls to `/api/*` endpoints
   - WebSocket connections via Socket.IO to `/socket.io/`
4. **Backend → Database**: SQLite queries via better-sqlite3
5. **Real-time Updates**: Socket.IO broadcasts game state, friend status, notifications

### Real-time Communication (Socket.IO)

The application uses Socket.IO for real-time multiplayer features:

**Client-Server Events:**
- `friend:request`, `friend:accept`, `friend:decline` - Friend system
- `game:join`, `game:leave`, `game:ready`, `game:move`, `game:pause`, `game:resume` - Game events
- `notification:send`, `notification:read` - Notifications
- `user:status_update`, `user:online`, `user:offline` - User presence
- `ping`, `pong` - Connection health checks

---

## 2. Project Structure

### Root Directory (`/home/crea/Desktop/ft_transcendence/`)

```
ft_transcendence/
├── docker-compose.yml          # Service orchestration configuration
├── Makefile                    # Docker management commands
├── README.md                   # Project overview
├── TODO                        # Current development tasks
├── .gitignore                 # Git ignore rules
├── docs/                      # Project documentation (markdown & PDFs)
├── srcs/                      # Source code for all services
│   ├── frontend/             # Vite TypeScript frontend
│   ├── backend/              # Fastify Node.js backend
│   ├── db/                   # SQLite database initialization
│   └── nginx/                # Nginx reverse proxy configuration
└── .git/                      # Git repository
```

### Frontend (`srcs/frontend/`)

```
frontend/
├── package.json              # Dependencies & npm scripts
├── package-lock.json         # Lock file for reproducible builds
├── vite.config.ts           # Vite build configuration
├── tsconfig.json            # TypeScript configuration
├── Dockerfile               # Frontend container definition
├── .env                     # Environment variables
├── .dockerignore            # Files to exclude from Docker build
├── .gitignore              # Git ignore rules
├── public/                 # Static assets
└── src/
    ├── main.ts              # Application bootstrap entry point
    ├── index.css            # Global TailwindCSS styles
    ├── vite-env.d.ts        # Vite type definitions
    ├── test-websocket-integration.ts  # WebSocket testing
    ├── assets/              # Images, fonts, static resources
    ├── components/          # Reusable UI components
    │   ├── auth/           # Login, registration forms
    │   ├── base/           # Base layout components
    │   ├── game/           # Game UI components
    │   └── ui/             # Generic UI widgets
    ├── pages/              # Full page components (routes)
    │   ├── auth/           # Auth pages (login, register, 2FA)
    │   ├── friends/        # Friends list and management
    │   ├── game/           # Game play pages
    │   ├── home/           # Home/dashboard pages
    │   ├── users/          # User profile pages
    │   └── index.ts        # Page exports
    ├── router/             # Client-side routing
    │   └── router.ts       # Route definitions and navigation
    ├── services/           # Business logic & API communication
    │   ├── auth/           # Authentication service (login, register, 2FA)
    │   ├── api/            # API client (friends, users)
    │   ├── game/           # Game service
    │   ├── user/           # User service
    │   ├── websocket/      # WebSocket/Socket.IO service
    │   ├── notification/   # Notification service
    │   ├── error/          # Error handling
    │   ├── utils/          # Utility functions (validation, password)
    │   └── index.ts        # Service exports
    └── stores/             # Application state management
```

### Backend (`srcs/backend/`)

```
backend/
├── package.json              # Dependencies (Fastify, JWT, OAuth2, etc.)
├── package-lock.json         # Lock file
├── Dockerfile               # Backend container definition
├── .env                     # Environment variables (JWT secret, DB path)
├── .dockerignore            # Files to exclude
├── .gitignore              # Git ignore
├── generate-jwt-secrets.js  # Utility to generate JWT secrets
└── src/
    ├── server.js            # Main Fastify server & Socket.IO initialization
    ├── database.js          # SQLite connection management
    ├── logger.js            # Centralized logging configuration
    ├── config/              # Configuration modules
    │   └── oauth.config.js  # OAuth 2.0 (Google) configuration
    ├── middleware/          # Express-style middleware
    │   ├── authentication.js # JWT/auth middleware
    │   └── validation.js    # Request validation middleware
    ├── plugins/             # Fastify plugins
    │   ├── swagger.js       # Swagger/OpenAPI documentation
    │   ├── error-handler.js # Global error handling
    │   └── index.js         # Plugin exports
    ├── routes/              # API route handlers
    │   ├── health.js        # Health check endpoint
    │   ├── auth/            # Authentication routes
    │   │   ├── login.js
    │   │   ├── register.js
    │   │   ├── oauth.js
    │   │   ├── 2fa.js
    │   │   └── index.js
    │   ├── users/           # User management routes
    │   │   ├── me.js        # Current user profile
    │   │   ├── username.js  # Update username
    │   │   ├── public-profile.js
    │   │   ├── search.js
    │   │   └── index.js
    │   └── index.js         # Route registration
    ├── schemas/             # Input/output validation schemas (JSON Schema/Zod)
    │   ├── routes/          # Route-specific schemas
    │   │   ├── auth.schema.js
    │   │   ├── user.schema.js
    │   │   └── oauth.schema.js
    │   └── common/          # Reusable schemas
    │       ├── user.schema.js
    │       └── responses.schema.js
    ├── services/            # Business logic
    │   ├── user.service.js  # User operations
    │   ├── email.service.js # Email sending (2FA, verification)
    │   ├── oauth-state.service.js # OAuth state management
    │   └── index.js         # Service exports
    └── utils/               # Utility functions
        ├── auth_utils.js    # Authentication helpers
        ├── jwt.js           # JWT token generation/verification
        ├── avatar-converter.js # Image processing
        ├── user-formatters.js # Data formatting
        ├── coockie.js        # Cookie management
        └── index.js          # Utility exports
```

### Database (`srcs/db/`)

```
db/
├── Dockerfile               # Database initialization container
├── .env                    # Environment variables
├── .dockerignore           # Files to exclude
├── .gitignore              # Git ignore
├── scripts/
│   ├── init-db.sh         # Database initialization entrypoint
│   └── seed-db.sh         # Database seeding
└── sql/
    ├── 01-schema.sql      # Main schema definition (tables, indexes)
    ├── 02-seed-roles.sql  # Initial roles (user, moderator, admin)
    ├── 03-seed-admin.sql.template # Admin user template
    └── 04-seed-user-stats.sql     # User statistics initialization
```

### Nginx (`srcs/nginx/`)

```
nginx/
├── Dockerfile               # Nginx container definition
├── docker-entrypoint.sh    # Startup script for config templating
├── nginx.conf              # Main nginx configuration
├── README.md               # Nginx-specific documentation
├── .env                    # Environment variables (HOST_DOMAIN)
├── .dockerignore           # Files to exclude
├── .gitignore              # Git ignore
├── conf.d/
│   └── default.conf.template # Server config (templated with envsubst)
├── ssl/                    # SSL certificate directory (self-signed)
└── error_pages/            # Error page HTML files
```

---

## 3. Technology Stack

### Backend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Fastify 5.1.0 | Lightweight, fast Node.js framework |
| **Runtime** | Node.js 24.8.0 (Alpine) | JavaScript runtime |
| **Database** | SQLite + better-sqlite3 | File-based relational DB, synchronous API |
| **Authentication** | JWT + Fastify-JWT | Stateless token-based auth |
| **OAuth 2.0** | Fastify-OAuth2 + Google API | Social login integration |
| **Real-time** | Socket.IO 4.8.1 | WebSocket communication |
| **Security** | Fastify-Helmet, bcrypt | Security headers, password hashing |
| **Rate Limiting** | Fastify-Rate-Limit | API endpoint protection |
| **File Upload** | Fastify-Multipart, Multer | File handling & validation |
| **Image Processing** | Sharp 0.34.4 | Avatar image manipulation |
| **Email** | Nodemailer 7.0.6 | Transactional email (2FA, verification) |
| **2FA** | Speakeasy + QR Code | TOTP authentication |
| **Logging** | Pino | Structured JSON logging |
| **Validation** | Fastify built-in AJV | JSON Schema validation |
| **API Docs** | Fastify-Swagger | OpenAPI/Swagger documentation |

### Frontend Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Vanilla TypeScript | No framework dependencies (lightweight SPA) |
| **Build Tool** | Vite 6.3.5 | Lightning-fast dev server & bundler |
| **Type Safety** | TypeScript 5.8 | Strict type checking |
| **Styling** | TailwindCSS 4.1 | Utility-first CSS framework |
| **Real-time** | Socket.IO Client 4.8.1 | WebSocket communication |
| **Validation** | Zod 4.1.11 | Runtime schema validation |
| **File Upload** | FilePond + plugins | Drag-drop file upload with preview |
| **OAuth** | Google APIs 160.0.0 | Google login integration |
| **Routing** | Custom Router | Lightweight client-side routing |

### Infrastructure

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| **Reverse Proxy** | Nginx 1.25 Alpine | 8000 (HTTP), 4433 (HTTPS) | SSL termination, request routing |
| **Frontend Server** | Vite Dev | 5173 (internal) | Development hot reload |
| **Backend Server** | Fastify | 8000 (internal) | REST API & WebSocket |
| **Database** | SQLite | File-based | Persistent data storage |
| **DB Browser** | SQLite Browser | 3000-3001 | Development inspection |
| **Container Runtime** | Docker | - | Application containerization |
| **Orchestration** | Docker Compose | - | Multi-container coordination |

---

## 4. Build and Development Commands

### Prerequisites

```bash
# Required installations
- Docker 20.10+
- Docker Compose 2.0+
- Git
- Make (optional, but convenient)
```

### Quick Start

#### Option 1: Using Make (Recommended)

```bash
# Build all services
make build

# Start all services in background
make up

# View status of all services
make show

# View real-time logs
make logs

# View logs for specific service
make logs-frontend
make logs-backend
make logs-nginx
make logs-db

# Restart all services
make restart

# Stop services
make stop

# Stop and remove containers (keep volumes)
make down

# Full cleanup (remove images, volumes, containers)
make fclean

# Full rebuild
make re

# Development mode (foreground, see all logs)
make dev

# Shell into a service
make exec-backend
make exec-frontend
make exec-nginx

# Check application health
make health

# View help
make help
```

#### Option 2: Using Docker Compose Directly

```bash
# Build images
docker compose build --parallel

# Start services
docker compose up -d

# View status
docker ps

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Stop services
docker compose down

# Full cleanup
docker compose down -v

# Restart
docker compose restart
```

### Access Points

Once services are running:

- **Frontend:** https://localhost:4433
- **Backend API:** https://localhost:4433/api
- **API Documentation:** https://localhost:4433/api/documentation
- **Health Check:** https://localhost:4433/health
- **SQLite Browser:** http://localhost:3000 (development only)

### Environment Setup

Each service requires an `.env` file (examples provided):

**Backend (`srcs/backend/.env`):**
```bash
NODE_ENV=development
PORT=8000
API_BASE_PATH=/api
LOG_LEVEL=info

# Database
DB_DIR=/app/db-data
DB_FILE=ft_transcendence.db

# JWT
JWT_SECRET=<generate with: node generate-jwt-secrets.js>

# Google OAuth 2.0 (optional)
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_REDIRECT_URI=https://localhost/api/auth/oauth/google/callback

# Email (for 2FA, verification)
SMTP_HOST=<smtp server>
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASSWORD=<password>
SMTP_FROM=noreply@transcendence.local

# CORS
FRONTEND_URL=http://localhost:5173
```

**Frontend (`srcs/frontend/.env`):**
```bash
VITE_API_BASE_URL=https://localhost:4433/api
VITE_WEBSOCKET_URL=https://localhost:4433
VITE_ENV=development
```

**Nginx (`srcs/nginx/.env`):**
```bash
HOST_DOMAIN=localhost
```

**Database (`srcs/db/.env`):**
```bash
DB_DIR=/app/db-data
DB_FILE=ft_transcendence.db
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@transcendence.local
```

### Development Workflow

#### Frontend Development

```bash
# Frontend runs with hot-reload (HMR) in container
# Changes to src/ automatically reload in browser

# Files watched:
# - src/**/*.ts
# - src/**/*.css
# - public/**/*

# Vite config includes path aliases for clean imports:
# @/components, @/pages, @/services, @/stores, @/router, @/assets
```

#### Backend Development

```bash
# Backend runs with nodemon (auto-restart on file changes)

# Backend entry point: src/server.js
# Supports ES modules (type: "module" in package.json)

# Run specific script:
npm run dev    # Development with hot-reload
npm run build  # Build step (no-op for Node.js)
npm run lint   # ESLint checks
npm run lint:fix # Auto-fix linting issues
```

#### Database Development

```bash
# Database is initialized on first container startup
# Uses SQL scripts in srcs/db/sql/

# Schema: 01-schema.sql
# Roles: 02-seed-roles.sql
# Admin user: 03-seed-admin.sql.template
# Stats: 04-seed-user-stats.sql

# Tables created:
# - users (authentication, profile)
# - roles (user roles)
# - user_roles (user-role mapping)
# - friend_requests (friend system)
# - friendships (confirmed friendships)
# - blocked_users (blocking system)
# - games (game history)
# - user_stats (game statistics)
# - oauth_state (OAuth flow state)
# - notifications (in-app notifications)
```

### Testing

```bash
# Backend unit tests (Node.js built-in test runner)
npm test

# Frontend integration test (WebSocket)
npm run dev  # Then check test-websocket-integration.ts

# Health checks (built-in via Docker Compose)
make health
```

### Performance & Optimization

#### Frontend Build

```bash
# Production build (no hot-reload)
npm run build

# Generates optimized dist/ for production deployment
```

#### Backend Optimization

- Uses better-sqlite3 (synchronous) for performance
- Implements connection pooling for database
- Request validation prevents unnecessary processing
- Rate limiting protects endpoints

#### Database Optimization

- Indexes on frequently queried columns (users.email, users.google_id)
- Foreign key constraints with cascading deletes
- PRAGMA optimizations in SQLite

### Common Issues & Solutions

#### Nginx SSL Certificate Issues
```bash
# Self-signed certificates are auto-generated
# For custom certs, replace files in srcs/nginx/ssl/
# - selfsigned.crt
# - selfsigned.key
```

#### Database Connection Timeout
```bash
# Backend waits 30 retries (5 minutes) for database
# If db container fails to initialize, check:
# - SQL script errors: make logs-db
# - File permissions: Dockerfile handles chown
# - Volume mounting: Check docker-compose.yml db-data volume
```

#### WebSocket Connection Issues
```bash
# Socket.IO uses /socket.io/ path (proxied by nginx)
# Ensure nginx conf includes WebSocket upgrade headers:
# - Upgrade header mapping in nginx.conf
# - proxy_set_header in default.conf.template
```

#### Hot Reload Not Working
```bash
# Frontend HMR requires:
# - vite.config.ts with correct HMR settings
# - Nginx proxy to /vite-hmr path
# - Browser WebSocket not blocked
# - Service ports correctly exposed
```

---

## 5. Key Architectural Patterns

### Authentication Flow

```
User → Frontend (login form)
      ↓
   REST API /api/auth/login
      ↓
   Backend validates credentials
      ↓
   Database user lookup
      ↓
   JWT token generation
      ↓
   Response with token + user data
      ↓
   Frontend stores token (localStorage)
      ↓
   Future requests: Authorization: Bearer <token>
```

### OAuth 2.0 Flow (Google)

```
User → Frontend "Login with Google"
    ↓
Frontend redirects to Google auth
    ↓
Google → User (consent screen)
    ↓
User authorizes → Google callback
    ↓
Backend receives auth code
    ↓
Backend exchanges code for token
    ↓
Backend fetches user info
    ↓
Create or update user in DB
    ↓
Generate JWT
    ↓
Redirect to frontend with token
```

### Two-Factor Authentication (2FA)

```
1. User enables 2FA
   - Backend generates TOTP secret
   - Frontend displays QR code
   - User scans with authenticator app

2. User logs in
   - Backend prompts for 2FA code
   - User enters code from authenticator
   - Backend validates with TOTP secret
   - JWT issued on success

3. Backup codes provided for account recovery
```

### Real-time Game Updates (Socket.IO)

```
Player 1 & 2 → Join game room via Socket.IO
            ↓
   Both ready → Backend sends game:start
            ↓
   During game:
     - game:move events from each player
     - Backend broadcasts game:update to room
     - Ball position, scores synchronized
            ↓
   Game end → game:finish event
```

### Database Schema Relationships

```
users ──┬──→ user_roles ──→ roles
        │
        ├──→ friend_requests ──→ users (to_user_id)
        │
        ├──→ friendships ──→ users (friend_id)
        │
        ├──→ blocked_users ──→ users (blocked_user_id)
        │
        ├──→ games ──┬──→ users (player1_id)
        │            └──→ users (player2_id)
        │
        └──→ user_stats (1:1)
```

---

## 6. Important Files & Modules

### Critical Backend Files

| File | Purpose |
|------|---------|
| `src/server.js` | Fastify initialization, Socket.IO setup, route registration |
| `src/database.js` | SQLite connection management with retry logic |
| `src/logger.js` | Centralized structured logging (Pino-based) |
| `src/routes/index.js` | Route registration and organization |
| `src/middleware/authentication.js` | JWT verification and authorization |
| `src/services/user.service.js` | User CRUD and profile management |
| `src/config/oauth.config.js` | OAuth 2.0 configuration validation |
| `src/plugins/swagger.js` | OpenAPI documentation generation |

### Critical Frontend Files

| File | Purpose |
|------|---------|
| `src/main.ts` | Application bootstrap and initialization |
| `src/router/router.ts` | Client-side routing logic |
| `src/services/auth/AuthService.ts` | Login, registration, 2FA flow |
| `src/services/websocket/WebSocketService.ts` | Socket.IO client wrapper |
| `src/services/game/GameService.ts` | Game state management |
| `src/index.css` | Global TailwindCSS + custom styles |
| `vite.config.ts` | Vite build and HMR configuration |

### Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Service definitions and networking |
| `Makefile` | Docker management commands |
| `srcs/nginx/nginx.conf` | Nginx main configuration |
| `srcs/nginx/conf.d/default.conf.template` | Server block configuration (templated) |
| `.gitignore` | Git ignore patterns across all services |

---

## 7. Deployment Considerations

### Security Features Implemented

- **HTTPS/TLS:** Nginx SSL termination (self-signed for dev, production certs needed)
- **JWT:** Stateless authentication with signed tokens
- **CORS:** Configured per-origin in nginx
- **Helmet:** Security headers via Fastify-Helmet
- **Rate Limiting:** Per-endpoint rate limiting
- **Password Hashing:** bcrypt with salt
- **2FA:** TOTP + backup codes
- **SQL Injection Prevention:** Parameterized queries via better-sqlite3

### Scaling Considerations

Current architecture is single-instance. For production scaling:

1. **Database:** SQLite → PostgreSQL (horizontal scaling)
2. **Cache:** Redis for session/state
3. **Load Balancing:** Multiple backend instances behind load balancer
4. **Socket.IO:** Redis adapter for multi-server Socket.IO
5. **Static Assets:** CDN for frontend files
6. **Logging:** Centralized logging (ELK stack, CloudWatch, etc.)

### Backup & Recovery

- Database: SQLite file-based backup via `make db-backup`
- Volumes: Docker named volume `db-data` persists across restarts
- Recovery: Database recreated from SQL scripts on container restart

---

## 8. Development Guidelines

### Code Organization

- **Services:** Business logic, API calls, external integrations
- **Components:** Reusable UI building blocks
- **Pages:** Full-page components corresponding to routes
- **Utils:** Pure functions (validation, formatting, calculations)
- **Stores:** Application state (currently minimal, could use Redux/Zustand)
- **Schemas:** Input/output validation rules

### Naming Conventions

- **Files:** camelCase.ts (TypeScript) or kebab-case.js (JavaScript)
- **Classes/Types:** PascalCase (e.g., UserService, AuthResponse)
- **Functions/Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Database Tables:** lowercase_plural (users, games, friend_requests)

### Validation Strategy

- **Frontend:** Zod schemas for client-side validation
- **Backend:** JSON Schema via AJV for API input validation
- **Database:** SQLite constraints (NOT NULL, UNIQUE, FOREIGN KEY)

### Error Handling

- **Backend:** Global error handler plugin returns consistent error format
- **Frontend:** Custom error classes (CustomErrors.ts) with error types
- **Socket.IO:** Error events for connection failures
- **Logging:** All errors logged with context (user ID, action, timestamp)

---

## 9. Troubleshooting Guide

### Backend Won't Start

```bash
# Check logs
make logs-backend

# Verify database is ready
make logs-db

# Common issues:
# - JWT_SECRET not set: Run generate-jwt-secrets.js
# - Port 8000 already in use: Check with lsof -i :8000
# - Database connection timeout: Wait for db container to initialize
```

### Frontend Shows Blank Page

```bash
# Check browser console for errors
# Verify network tab for 502/503 errors (nginx issue)
make logs-nginx

# Check Vite dev server
make logs-frontend

# Verify HMR is working:
# - Network tab should show WebSocket to /vite-hmr
# - Console should show ">>> [vite] connected"
```

### WebSocket Connection Fails

```bash
# Check nginx logs for proxy errors
make logs-nginx

# Verify Socket.IO namespace available
curl https://localhost:4433/socket.io/?EIO=4

# Browser console should show Socket.IO connection
# Check Network tab for /socket.io/ WebSocket upgrade
```

### Database File Corruption

```bash
# Reset database (removes all data)
make clean
make build
make up

# Backup data first
make db-backup

# Restore from backup (if available)
# Manual steps needed - copy backup.db to db-data/ft_transcendence.db
```

---

## 10. Additional Resources

### Documentation Files

Located in `docs/` directory:

- Frontend architecture and implementation details
- Socket.IO integration guide
- API reference with examples
- Password reset flow documentation
- 2FA implementation analysis
- Email verification system
- TailwindCSS styling guide

### External Documentation

- [Fastify Documentation](https://www.fastify.io/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Nginx Documentation](https://nginx.org/en/docs/)

---

**Last Updated:** November 3, 2025
**Project Status:** Active Development (User System & Auth Implementation)
**Current Branch:** dev
