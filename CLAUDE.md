# ft_transcendence - Microservices Architecture Design

## Executive Summary

This document describes the architecture for a real-time multiplayer Pong game platform with comprehensive user management, authentication, and game modes. The system is designed with a microservices backend, TypeScript/TailwindCSS frontend, and supports local, multiplayer, and AI game modes.

---

## 0. Project Status & Migration Plan

### Current State (As of 2025-01-07)

**✅ Microservices Architecture: Complete**

The project has successfully transitioned from a monolithic backend to a fully microservices-based architecture.

#### ✅ **Implemented Components**
- **Frontend:** TypeScript + Vite + TailwindCSS (fully operational)
- **Nginx Reverse Proxy:** HTTPS termination, custom domain (`ft_transcendence.42.crea`)
- **Microservices (Production-Ready):**
  - ✅ API Gateway (Fastify + Node.js)
  - ✅ Auth Service (OAuth 2.0, 2FA, JWT)
  - ✅ User Service (profiles, friends, stats)
  - ✅ Game Service (game logic, tournaments, AI)
  - ✅ WebSocket Server (Socket.IO, real-time communication)
- **Database:** SQLite (shared volume across services)

#### 🎯 **Migration Goals**
1. **Phase 1 (Completed):** Establish microservices infrastructure
   - API Gateway routing ✅
   - Auth Service with OAuth 2.0 + 2FA ✅
   - User Service with friends system ✅
   - Game Service with tournament support ✅
   - WebSocket Server for real-time ✅

2. **Phase 2 (Completed):** Migrate remaining monolith features
   - All backend functionality migrated to microservices ✅
   - Frontend API calls updated to use microservices ✅
   - All routes properly configured in API Gateway ✅

3. **Phase 3 (Completed):** Remove monolithic backend
   - Removed `backend` service from docker-compose.yml ✅
   - Removed backend directory ✅
   - Updated documentation ✅
   - Final testing and validation ✅

#### 📊 **Service Port Allocation**
```
Nginx (HTTPS):        443, 80
Frontend (Vite Dev):  5173
API Gateway:          8001
Auth Service:         3001
User Service:         3002
Game Service:         3003
WebSocket Server:     3100
```

#### 🔗 **Domain Configuration**
- **Custom Domain:** `ft_transcendence.42.crea` (configured in `/srcs/nginx/.env`)
- **HTTPS:** Enforced with automatic HTTP → HTTPS redirect
- **Access:** All services accessible through nginx reverse proxy

---

## 1. System Architecture Overview (Target State)

```
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX Reverse Proxy (HTTPS)                  │
│                   Ports: 443 (HTTPS), 80→443                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Frontend (TypeScript + TailwindCSS)          │ │
│  │  • SPA with Client-Side Routing                           │ │
│  │  • Socket.IO Client for Real-time                         │ │
│  │  • Responsive UI (TailwindCSS)                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  API Gateway (Fastify)                    │ │
│  │  • Route orchestration                                    │ │
│  │  • JWT verification                                       │ │
│  │  • Rate limiting                                          │ │
│  │  • Request validation                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌─────────────────────── MICROSERVICES ─────────────────────┐ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │ │
│  │  │   Auth       │  │    User      │  │    Game      │   │ │
│  │  │   Service    │  │   Service    │  │   Service    │   │ │
│  │  │              │  │              │  │              │   │ │
│  │  │ • Login/Reg  │  │ • Profiles   │  │ • Game Logic │   │ │
│  │  │ • OAuth 2.0  │  │ • Friends    │  │ • Matchmaking│   │ │
│  │  │ • 2FA/MFA    │  │ • Search     │  │ • Tournaments│   │ │
│  │  │ • JWT        │  │ • Stats      │  │ • AI Engine  │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │ │
│  │                                                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │ │
│  │  │ Notification │  │   Match      │  │   Chat       │   │ │
│  │  │   Service    │  │   History    │  │   Service    │   │ │
│  │  │              │  │   Service    │  │              │   │ │
│  │  │ • Real-time  │  │ • Game Logs  │  │ • Direct Msg │   │ │
│  │  │ • Alerts     │  │ • Statistics │  │ • Blocking   │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              WebSocket Server (Socket.IO)                 │ │
│  │  • Real-time game state                                   │ │
│  │  • Player movements                                       │ │
│  │  • Chat messages                                          │ │
│  │  • Friend status updates                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                              ↓                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  Database Layer (SQLite)                  │ │
│  │  • users, roles, sessions                                 │ │
│  │  • friendships, blocked_users                             │ │
│  │  • games, tournaments, match_history                      │ │
│  │  • user_stats, notifications                              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Breakdown

### 2.1 Reverse Proxy Layer (Nginx)

**Purpose:** SSL termination, request routing, load balancing

**Configuration:**
```
nginx/
├── nginx.conf                 # Main config
├── conf.d/
│   └── default.conf          # Server blocks, routing rules
├── ssl/
│   ├── cert.pem              # SSL certificate
│   └── key.pem               # Private key
└── Dockerfile
```

**Responsibilities:**
- HTTPS enforcement (redirect HTTP → HTTPS)
- TLS/SSL termination
- Proxy `/api/*` → API Gateway
- Proxy `/socket.io/` → WebSocket Server
- Proxy `/*` → Frontend static files
- WebSocket upgrade handling
- Security headers (HSTS, CSP, X-Frame-Options)

---

### 2.2 Frontend Layer

**Tech Stack:** TypeScript + Vite + TailwindCSS

```
frontend/
├── src/
│   ├── main.ts                    # Entry point
│   ├── router/
│   │   └── index.ts              # SPA routing (history API)
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── LoginPage.ts      # Login + OAuth buttons
│   │   │   ├── RegisterPage.ts   # Registration
│   │   │   └── TwoFactorPage.ts  # 2FA verification
│   │   ├── dashboard/
│   │   │   └── DashboardPage.ts  # User home
│   │   ├── profile/
│   │   │   ├── ProfilePage.ts    # View/edit profile
│   │   │   └── StatsPage.ts      # User statistics
│   │   ├── friends/
│   │   │   ├── FriendsPage.ts    # Friends list
│   │   │   └── SearchPage.ts     # User search
│   │   ├── game/
│   │   │   ├── LocalGamePage.ts  # Same-keyboard 2P
│   │   │   ├── OnlineGamePage.ts # Multiplayer
│   │   │   ├── AIGamePage.ts     # vs AI
│   │   │   └── TournamentPage.ts # Tournament UI
│   │   └── chat/
│   │       └── ChatPage.ts       # Direct messaging
│   ├── components/
│   │   ├── GameCanvas.ts         # Pong rendering
│   │   ├── UserCard.ts
│   │   ├── FriendList.ts
│   │   ├── TournamentBracket.ts
│   │   └── Navbar.ts
│   ├── services/
│   │   ├── api/
│   │   │   ├── ApiClient.ts      # HTTP client (fetch wrapper)
│   │   │   ├── AuthAPI.ts
│   │   │   ├── UserAPI.ts
│   │   │   ├── GameAPI.ts
│   │   │   └── FriendAPI.ts
│   │   ├── websocket/
│   │   │   └── SocketManager.ts  # Socket.IO client
│   │   ├── game/
│   │   │   ├── LocalGameEngine.ts  # Client-side game (local)
│   │   │   ├── OnlineGameClient.ts # Server-authoritative
│   │   │   └── AIOpponent.ts       # AI logic
│   │   └── auth/
│   │       └── TokenManager.ts   # JWT storage/refresh
│   ├── store/
│   │   ├── UserStore.ts          # User state management
│   │   └── GameStore.ts          # Game state
│   └── utils/
│       ├── validation.ts
│       └── formatters.ts
├── public/
│   └── assets/
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── Dockerfile
```

**Key Features:**
- SPA with History API routing (back/forward support)
- JWT stored in localStorage (with refresh mechanism)
- Socket.IO for real-time updates
- Responsive design (mobile-first)
- Form validation (Zod)

---

### 2.3 API Gateway

**Tech Stack:** Fastify + Node.js

**Purpose:** Single entry point for all microservices

```
api-gateway/
├── src/
│   ├── server.ts                 # Main server
│   ├── config/
│   │   └── routes.config.ts     # Route mappings
│   ├── middleware/
│   │   ├── auth.middleware.ts   # JWT verification
│   │   ├── rateLimit.middleware.ts
│   │   └── validation.middleware.ts
│   ├── plugins/
│   │   ├── swagger.plugin.ts
│   │   └── cors.plugin.ts
│   └── utils/
│       └── serviceProxy.ts      # Proxy to microservices
└── Dockerfile
```

**Responsibilities:**
- Route requests to appropriate microservices
- JWT token verification (except auth routes)
- Rate limiting (per user, per IP)
- Request/response logging
- API documentation (Swagger)
- CORS handling

**Route Mapping:**
```
/api/auth/*       → Auth Service
/api/users/*      → User Service
/api/games/*      → Game Service
/api/friends/*    → User Service
/api/chat/*       → Chat Service
/api/notifications/* → Notification Service
/api/history/*    → Match History Service
```

---

### 2.4 Microservices Layer

#### 2.4.1 Auth Service

**Purpose:** Authentication, authorization, session management

```
auth-service/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── login.route.ts       # POST /auth/login
│   │   ├── register.route.ts    # POST /auth/register
│   │   ├── oauth.route.ts       # GET/POST /auth/oauth/*
│   │   ├── twoFactor.route.ts   # POST /auth/2fa/*
│   │   └── refresh.route.ts     # POST /auth/refresh
│   ├── services/
│   │   ├── authService.ts       # Core auth logic
│   │   ├── oauthService.ts      # OAuth 2.0 (Google, GitHub, 42)
│   │   ├── twoFactorService.ts  # TOTP generation/verification
│   │   └── jwtService.ts        # Token generation/validation
│   ├── models/
│   │   └── User.model.ts
│   └── utils/
│       ├── password.util.ts     # bcrypt hashing
│       └── crypto.util.ts       # Secret generation
└── Dockerfile
```

**Features:**
- Local authentication (email/password)
- OAuth 2.0 integration (Google, GitHub, 42 Intra)
- Two-Factor Authentication (TOTP with QR codes)
- JWT token issuance (access + refresh tokens)
- Password reset flow
- Email verification
- Secure session management

**Database Tables:**
- `users` (id, email, password_hash, email_verified, created_at)
- `oauth_accounts` (user_id, provider, provider_user_id)
- `two_factor` (user_id, secret, backup_codes, enabled)
- `refresh_tokens` (user_id, token_hash, expires_at)

---

#### 2.4.2 User Service

**Purpose:** User profiles, friends, search, stats

```
user-service/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── profile.route.ts     # GET/PUT /users/me
│   │   ├── publicProfile.route.ts # GET /users/:id
│   │   ├── friends.route.ts     # POST/GET /users/friends/*
│   │   ├── search.route.ts      # GET /users/search
│   │   ├── stats.route.ts       # GET /users/:id/stats
│   │   └── avatar.route.ts      # POST /users/avatar
│   ├── services/
│   │   ├── userService.ts
│   │   ├── friendService.ts
│   │   └── statsService.ts
│   └── utils/
│       └── imageProcessing.ts   # Avatar upload/resize
└── Dockerfile
```

**Features:**
- User profiles (username, display name, avatar, bio)
- Friend system (send/accept/decline/remove)
- Friend online status (via WebSocket)
- User search (by username/display name)
- Block/unblock users
- User statistics (wins, losses, rank, play time)
- Match history integration
- Avatar upload with validation

**Database Tables:**
- `user_profiles` (user_id, username, display_name, avatar_url, bio)
- `friendships` (user_id, friend_id, status, created_at)
- `blocked_users` (user_id, blocked_user_id)
- `user_stats` (user_id, games_played, wins, losses, rank, total_score)

---

#### 2.4.3 Game Service

**Purpose:** Game logic, matchmaking, tournaments, AI

```
game-service/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── game.route.ts        # POST/GET /games/*
│   │   ├── tournament.route.ts  # POST/GET /tournaments/*
│   │   ├── matchmaking.route.ts # POST /games/matchmaking
│   │   └── ai.route.ts          # POST /games/ai/start
│   ├── services/
│   │   ├── gameService.ts       # Game creation/management
│   │   ├── matchmakingService.ts # Queue + ELO matching
│   │   ├── tournamentService.ts # Bracket generation
│   │   └── aiService.ts         # AI opponent logic
│   ├── engine/
│   │   ├── PongEngine.ts        # Server-authoritative game state
│   │   ├── Physics.ts           # Ball/paddle physics
│   │   ├── Collision.ts         # Collision detection
│   │   └── AIPlayer.ts          # AI decision-making
│   └── models/
│       ├── Game.model.ts
│       └── Tournament.model.ts
└── Dockerfile
```

**Game Modes:**
1. **Local (Same Keyboard):** Pure client-side, no server
2. **Multiplayer (Remote):** Server-authoritative with client prediction
3. **AI Opponent:** Server simulates AI with keyboard constraints
4. **Tournament:** Multi-round bracket system

**Server-Authoritative Game Loop:**
```typescript
// Game runs at 60 TPS (ticks per second)
// Client sends inputs, server computes state, broadcasts updates
setInterval(() => {
  processPlayerInputs();
  updateBallPosition();
  checkCollisions();
  updateScore();
  broadcastGameState();
}, 1000 / 60);
```

**AI Constraints (Per Subject):**
- AI can only "see" game state once per second
- Must simulate keyboard input (not perfect tracking)
- Must anticipate ball trajectory
- Same paddle speed as human players

**Database Tables:**
- `games` (id, mode, player1_id, player2_id, status, winner_id, created_at)
- `game_state` (game_id, state_json, updated_at)
- `tournaments` (id, name, status, bracket_json, created_at)
- `tournament_participants` (tournament_id, user_id, seed)

---

#### 2.4.4 Match History Service

**Purpose:** Game logs, statistics aggregation

```
match-history-service/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── history.route.ts     # GET /history/:userId
│   │   └── stats.route.ts       # GET /stats/:userId
│   ├── services/
│   │   ├── historyService.ts
│   │   └── statsAggregator.ts   # Real-time stats calculation
│   └── models/
│       └── MatchHistory.model.ts
└── Dockerfile
```

**Features:**
- Store complete match data (scores, duration, moves)
- User match history with filters
- Head-to-head statistics
- Leaderboards
- Performance analytics

**Database Tables:**
- `match_history` (id, game_id, player1_id, player2_id, score1, score2, duration, winner_id, created_at)
- `match_events` (match_id, event_type, event_data, timestamp)

---

#### 2.4.5 Notification Service

**Purpose:** Real-time notifications, alerts

```
notification-service/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── notifications.route.ts # GET/PUT /notifications/*
│   ├── services/
│   │   ├── notificationService.ts
│   │   └── socketEmitter.ts       # Emit to Socket.IO
│   └── types/
│       └── NotificationType.ts
└── Dockerfile
```

**Notification Types:**
- Friend request received
- Friend request accepted
- Game invitation
- Tournament starting
- Match completed
- User came online

**Database Tables:**
- `notifications` (id, user_id, type, message, data_json, read, created_at)

---

#### 2.4.6 Chat Service

**Purpose:** Direct messaging, user blocking

```
chat-service/
├── src/
│   ├── server.ts
│   ├── routes/
│   │   ├── messages.route.ts    # GET/POST /chat/messages
│   │   └── block.route.ts       # POST /chat/block
│   ├── services/
│   │   ├── chatService.ts
│   │   └── messageValidator.ts  # XSS prevention
│   └── models/
│       └── Message.model.ts
└── Dockerfile
```

**Features:**
- Direct messages between users
- Message history
- Block users (no messages shown)
- Online/offline status
- Real-time message delivery via WebSocket

**Database Tables:**
- `messages` (id, sender_id, receiver_id, content, created_at)
- `chat_blocks` (user_id, blocked_user_id)

---

### 2.5 WebSocket Server

**Tech Stack:** Socket.IO + Node.js

```
websocket-server/
├── src/
│   ├── server.ts
│   ├── handlers/
│   │   ├── gameHandler.ts       # Game events
│   │   ├── chatHandler.ts       # Chat events
│   │   ├── friendHandler.ts     # Friend status
│   │   └── notificationHandler.ts
│   ├── middleware/
│   │   └── socketAuth.ts        # JWT verification
│   └── utils/
│       └── roomManager.ts       # Game rooms
└── Dockerfile
```

**Socket.IO Events:**

**Client → Server:**
- `game:move` - Paddle movement
- `game:ready` - Player ready
- `chat:message` - Send message
- `friend:request` - Send friend request
- `presence:update` - User online/offline

**Server → Client:**
- `game:state` - Game state update (60Hz)
- `game:start` - Game started
- `game:end` - Game finished
- `chat:message` - New message
- `notification:new` - New notification
- `friend:online` - Friend came online

**Room Structure:**
```typescript
// Game room: game_{gameId}
// User room: user_{userId}
// Friend broadcast: friends_{userId}
```

---

### 2.6 Database Layer

**Tech Stack:** SQLite (single file, better-sqlite3)

**Database Schema:**

```sql
-- Users & Auth
users (id, email, password_hash, email_verified, created_at)
oauth_accounts (user_id, provider, provider_user_id)
two_factor (user_id, secret, backup_codes, enabled)
refresh_tokens (user_id, token_hash, expires_at)
roles (id, name)
user_roles (user_id, role_id)

-- Profiles & Social
user_profiles (user_id, username, display_name, avatar_url, bio)
friendships (user_id, friend_id, status, created_at)
blocked_users (user_id, blocked_user_id)

-- Games
games (id, mode, player1_id, player2_id, status, winner_id, created_at)
game_state (game_id, state_json, updated_at)
tournaments (id, name, status, bracket_json, created_at)
tournament_participants (tournament_id, user_id, seed)

-- History & Stats
match_history (id, game_id, player1_id, player2_id, score1, score2, duration, winner_id, created_at)
user_stats (user_id, games_played, wins, losses, rank, total_score)

-- Messaging
messages (id, sender_id, receiver_id, content, created_at)
notifications (id, user_id, type, message, data_json, read, created_at)
```

**Migrations:**
```
db/migrations/
├── 001_initial_schema.sql
├── 002_add_oauth.sql
├── 003_add_2fa.sql
└── 004_add_tournaments.sql
```

---

## 3. Inter-Service Communication

### 3.1 Synchronous (HTTP/REST)

**Pattern:** API Gateway proxies to microservices

**Example:**
```
Client → API Gateway → User Service
  GET /api/users/me
    → JWT verified in Gateway
    → Forwarded to User Service with user_id
    → User Service queries DB
    → Response returned
```

### 3.2 Asynchronous (Event Bus)

**Option 1: Redis Pub/Sub** (if adding Redis for scaling)
**Option 2: In-process events** (for MVP)

**Events:**
- `user.created` → Notification Service sends welcome
- `game.finished` → Match History logs, User Stats update
- `friend.request` → Notification sent to recipient
- `user.online` → Broadcast to all friends

---

## 4. Authentication & Security

### 4.1 JWT Flow

```
1. User logs in
   ↓
2. Auth Service validates credentials
   ↓
3. Generate access token (15 min) + refresh token (7 days)
   ↓
4. Client stores tokens in localStorage
   ↓
5. Every API request includes: Authorization: Bearer <access_token>
   ↓
6. API Gateway verifies JWT signature
   ↓
7. Extract user_id from JWT payload
   ↓
8. Forward to microservice with user context
```

**JWT Payload:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "roles": ["user"],
  "iat": 1234567890,
  "exp": 1234568790
}
```

### 4.2 OAuth 2.0 Flow

```
1. User clicks "Login with Google"
   ↓
2. Redirect to Google OAuth consent screen
   ↓
3. Google redirects back with auth code
   ↓
4. Backend exchanges code for access token
   ↓
5. Fetch user info from Google
   ↓
6. Create/update user in DB
   ↓
7. Generate JWT token
   ↓
8. Redirect to frontend with token
```

### 4.3 Two-Factor Authentication (2FA)

```
1. User enables 2FA in settings
   ↓
2. Server generates TOTP secret (32-char base32)
   ↓
3. QR code displayed with: otpauth://totp/Transcendence:{email}?secret={secret}
   ↓
4. User scans with authenticator app
   ↓
5. User enters verification code to confirm
   ↓
6. Server validates and enables 2FA

Login with 2FA:
1. User enters email/password
   ↓
2. Server checks if 2FA enabled
   ↓
3. Return temporary token requiring 2FA
   ↓
4. User enters TOTP code
   ↓
5. Server validates (30-sec time window)
   ↓
6. Issue full JWT tokens
```

**Backup Codes:** 10 single-use codes for recovery

### 4.4 Security Measures

**Password Hashing:** bcrypt (rounds: 12)
**SQL Injection:** Parameterized queries only
**XSS Prevention:** Sanitize all user input, Content-Security-Policy headers
**CSRF:** SameSite cookies for refresh tokens
**Rate Limiting:**
  - Login: 5 attempts per 15 min
  - API: 100 requests per min per user
  - WebSocket: Connection throttling
**HTTPS:** Enforced everywhere
**Input Validation:** JSON Schema validation on all endpoints

---

## 5. Game Architecture

### 5.1 Local Game (Same Keyboard) - **MANDATORY FEATURE**

**Subject Requirement:**
> "Users must be able to participate in a live Pong game against another player directly on the website. Both players will use the same keyboard."

This is a **mandatory baseline feature** that must work WITHOUT any modules or user accounts.

**Implementation Details:**

**Architecture:**
- **Pure client-side** - No server communication during gameplay
- **Canvas-based rendering** at 60 FPS
- **No authentication required** - Accessible to anyone visiting the site
- **Immediate play** - No setup, registration, or waiting

**Keyboard Controls:**
```typescript
// Player 1 (Left Paddle)
- W: Move paddle up
- S: Move paddle down

// Player 2 (Right Paddle)
- Arrow Up: Move paddle up
- Arrow Down: Move paddle down
```

**Game Flow:**
```
1. User navigates to local game page
2. Game starts immediately (or on "Start" button)
3. Both players control paddles with keyboard
4. Ball physics calculated client-side
5. Score tracked in browser
6. Game ends at target score (e.g., 11 points)
7. Optional: Submit final score to server (if user logged in)
```

**Technical Implementation:**
```typescript
// LocalGameEngine.ts
class LocalGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: {
    paddle1: { y: number, velocity: number };
    paddle2: { y: number, velocity: number };
    ball: { x: number, y: number, vx: number, vy: number };
    score: { player1: number, player2: number };
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.initGame();
    this.setupKeyboardListeners();
  }

  private setupKeyboardListeners() {
    // Player 1: W/S keys
    // Player 2: Arrow Up/Down
    document.addEventListener('keydown', (e) => {
      if (e.key === 'w') this.gameState.paddle1.velocity = -1;
      if (e.key === 's') this.gameState.paddle1.velocity = 1;
      if (e.key === 'ArrowUp') this.gameState.paddle2.velocity = -1;
      if (e.key === 'ArrowDown') this.gameState.paddle2.velocity = 1;
    });
  }

  private gameLoop() {
    requestAnimationFrame(() => this.gameLoop());
    this.update();
    this.render();
  }

  private update() {
    // Update paddle positions
    // Update ball position
    // Check collisions
    // Update score
  }
}
```

**File Location:** `frontend/src/services/game/LocalGameEngine.ts`
**Page Component:** `frontend/src/pages/game/LocalGamePage.ts`

**Post-Game Options:**
- **Without User Accounts:** Display final score, option to play again
- **With User Accounts Module:** Optionally save match to history (if both players logged in)

### 5.2 Multiplayer (Remote)

**Architecture:** Server-authoritative with client prediction

**Flow:**
```
Client 1                Server                  Client 2
   |                      |                        |
   |-- game:join -------->|                        |
   |                      |<------- game:join -----|
   |                      |                        |
   |                   [Create room]               |
   |                      |                        |
   |<-- game:start -------|------> game:start -----|
   |                      |                        |
   |-- input:move ------->|                        |
   |                   [Compute]                   |
   |<-- game:state -------|------> game:state -----|
   |                      |                        |
```

**Server Game Loop (60 TPS):**
```typescript
const TICK_RATE = 60;
const MS_PER_TICK = 1000 / TICK_RATE;

setInterval(() => {
  // 1. Process queued player inputs
  applyPlayerInputs();

  // 2. Update ball physics
  ball.x += ball.velocityX * deltaTime;
  ball.y += ball.velocityY * deltaTime;

  // 3. Check collisions (walls, paddles)
  handleCollisions();

  // 4. Update score if ball out of bounds
  if (ball.x < 0) {
    player2Score++;
    resetBall();
  }

  // 5. Broadcast state to all players
  io.to(`game_${gameId}`).emit('game:state', {
    ball: { x: ball.x, y: ball.y },
    paddle1: { y: paddle1.y },
    paddle2: { y: paddle2.y },
    score: { p1: player1Score, p2: player2Score }
  });
}, MS_PER_TICK);
```

**Client Prediction:** Client immediately moves paddle, server validates

### 5.3 AI Opponent

**Constraints (per subject):**
- AI can only update once per second
- Must simulate keyboard input (not perfect tracking)
- Same paddle speed as humans

**Algorithm:**
```typescript
class AIPlayer {
  lastUpdate: number = 0;
  predictedBallY: number = 0;
  targetY: number = 0;

  update(gameState: GameState, currentTime: number) {
    // Only compute every 1000ms (per subject requirement)
    if (currentTime - this.lastUpdate >= 1000) {
      this.predictedBallY = this.predictBallPosition(gameState.ball);
      this.targetY = this.calculateTargetPosition(this.predictedBallY);
      this.lastUpdate = currentTime;
    }

    // Simulate keyboard press (gradual movement)
    const currentPaddleY = gameState.paddle2.y;
    if (Math.abs(this.targetY - currentPaddleY) > 5) {
      return this.targetY > currentPaddleY ? 'DOWN' : 'UP';
    }
    return null;
  }

  predictBallPosition(ball: Ball): number {
    // Raycast to predict where ball will be at paddle X position
    // Account for wall bounces
    let x = ball.x;
    let y = ball.y;
    let vx = ball.velocityX;
    let vy = ball.velocityY;

    while (x < PADDLE2_X) {
      x += vx;
      y += vy;
      if (y <= 0 || y >= CANVAS_HEIGHT) {
        vy *= -1; // Bounce off wall
      }
    }

    return y;
  }
}
```

**Difficulty Levels:**
- Easy: Random errors in prediction
- Medium: Accurate prediction
- Hard: Anticipates player patterns

### 5.4 Tournament System - **MANDATORY FEATURE**

**Subject Requirement:**
> "A player must be able to play against another, and a tournament system should also be available... A registration system is required: at the start of a tournament, each player must input their alias."

This is a **mandatory baseline feature** that must work WITHOUT the Standard User Management module.

**Two Implementation Modes:**

#### **Mode 1: WITHOUT User Management Module (Mandatory Minimum)**

**Alias Registration:**
```typescript
// Tournament starts
Tournament.create() → {
  participants: [],
  aliases: Map<participantId, alias>
}

// Each player enters alias
Player enters: "GhostKing42"
→ Stored temporarily in tournament.aliases
→ Valid ONLY for this tournament session
→ Reset when new tournament begins
```

**Features:**
- Players enter **temporary alias** at tournament start
- Aliases are **unique within tournament** (validation required)
- Aliases **do not persist** after tournament ends
- **No authentication required** - Anyone can join
- Tournament history **not saved** (unless module added)

**Flow:**
```
1. User creates new tournament
2. Other users join tournament
3. Each participant enters alias (checked for uniqueness)
4. Tournament creator starts when ready
5. System generates bracket
6. Matches played sequentially
7. Winner announced
8. Tournament ends → all aliases cleared
```

**Database (Minimal):**
```sql
-- Only if saving tournament results (optional)
tournaments (id, name, status, bracket_json, created_at)
tournament_participants (tournament_id, alias, seed)
-- No user_id linkage without User Management module
```

#### **Mode 2: WITH User Management Module (Enhanced)**

**Registered User Integration:**
```typescript
// Users must be logged in
Tournament.create() → {
  participants: User[],  // Full user objects
  creatorId: userId
}

// Aliases use registered usernames
Player.username → Used as tournament alias
→ Persisted in user account
→ Linked to tournament history
```

**Enhanced Features:**
- Automatic alias from **registered username**
- Tournament history **saved to user profile**
- **Persistent statistics** (tournaments won, matches played)
- **Friend invitations** to tournaments
- **ELO rankings** across tournaments
- **Matchmaking** by skill level

**Database (Enhanced):**
```sql
tournaments (id, name, creator_user_id, status, bracket_json, created_at)
tournament_participants (tournament_id, user_id, seed, final_position)
user_tournament_stats (user_id, tournaments_played, tournaments_won, total_matches)
```

**Subject Compliance Note:**
> "The tournament system must work with or without user registration. Without the Standard User Management module: users manually input an alias. With the module: aliases are linked to registered accounts, allowing persistent stats and friend lists. The module extends the tournament logic; it does not replace it."

**Implementation Priority:**
1. **First:** Implement Mode 1 (alias-based, no accounts)
2. **Then:** Add User Management module
3. **Finally:** Enhance tournament system to use registered users when available

**Tournament Bracket Example:**
```
Round 1 (Quarterfinals):
  Match 1: "GhostKing42" vs "ProPaddle"
  Match 2: "BallMaster" vs "PongChamp"
  Match 3: "QuickReflexes" vs "WallBouncer"
  Match 4: "SpinKing" vs "AcePlayer"

Round 2 (Semifinals):
  Match 5: Winner(1) vs Winner(2)
  Match 6: Winner(3) vs Winner(4)

Finals:
  Match 7: Winner(5) vs Winner(6)
```

**Matchmaking System:**
- **Without User Module:** Random bracket seeding
- **With User Module:** Seeding by ELO rating or tournament wins

---

## 6. Deployment Architecture

### 6.1 Docker Compose

```yaml
version: '3.8'

services:
  nginx:
    build: ./nginx
    ports:
      - "443:443"
      - "80:80"
    depends_on:
      - frontend
      - api-gateway
    networks:
      - transcendence-net

  frontend:
    build: ./frontend
    environment:
      - VITE_API_URL=https://localhost/api
      - VITE_WS_URL=https://localhost
    networks:
      - transcendence-net

  api-gateway:
    build: ./api-gateway
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - AUTH_SERVICE_URL=http://auth-service:3000
      - USER_SERVICE_URL=http://user-service:3001
      - GAME_SERVICE_URL=http://game-service:3002
    depends_on:
      - auth-service
      - user-service
      - game-service
    networks:
      - transcendence-net

  auth-service:
    build: ./services/auth-service
    environment:
      - DATABASE_URL=/data/db.sqlite
      - JWT_SECRET=${JWT_SECRET}
      - OAUTH_GOOGLE_ID=${OAUTH_GOOGLE_ID}
      - OAUTH_GOOGLE_SECRET=${OAUTH_GOOGLE_SECRET}
    volumes:
      - db-data:/data
    networks:
      - transcendence-net

  user-service:
    build: ./services/user-service
    environment:
      - DATABASE_URL=/data/db.sqlite
    volumes:
      - db-data:/data
    networks:
      - transcendence-net

  game-service:
    build: ./services/game-service
    environment:
      - DATABASE_URL=/data/db.sqlite
    volumes:
      - db-data:/data
    networks:
      - transcendence-net

  match-history-service:
    build: ./services/match-history-service
    environment:
      - DATABASE_URL=/data/db.sqlite
    volumes:
      - db-data:/data
    networks:
      - transcendence-net

  notification-service:
    build: ./services/notification-service
    environment:
      - DATABASE_URL=/data/db.sqlite
      - WEBSOCKET_URL=http://websocket-server:3100
    volumes:
      - db-data:/data
    networks:
      - transcendence-net

  chat-service:
    build: ./services/chat-service
    environment:
      - DATABASE_URL=/data/db.sqlite
      - WEBSOCKET_URL=http://websocket-server:3100
    volumes:
      - db-data:/data
    networks:
      - transcendence-net

  websocket-server:
    build: ./websocket-server
    environment:
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - transcendence-net

volumes:
  db-data:

networks:
  transcendence-net:
    driver: bridge
```

### 6.2 Single Command Startup

```bash
# From project root
docker-compose up --build

# Or with Makefile
make build
make up
```

---

## 7. Directory Structure

```
ft_transcendence/
├── docker-compose.yml
├── Makefile
├── .env.example
├── ARCHITECTURE.md
├── README.md
│
├── nginx/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── conf.d/
│   │   └── default.conf
│   └── ssl/
│       ├── cert.pem
│       └── key.pem
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.ts
│   │   ├── router/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/
│   │   ├── store/
│   │   └── utils/
│   └── public/
│
├── api-gateway/
│   ├── Dockerfile
│   ├── package.json
│   ├── src/
│   │   ├── server.ts
│   │   ├── middleware/
│   │   ├── plugins/
│   │   └── utils/
│   └── tsconfig.json
│
├── services/
│   ├── auth-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/
│   │       ├── services/
│   │       ├── models/
│   │       └── utils/
│   │
│   ├── user-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       └── [similar structure]
│   │
│   ├── game-service/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/
│   │       ├── services/
│   │       └── engine/
│   │           ├── PongEngine.ts
│   │           ├── Physics.ts
│   │           ├── Collision.ts
│   │           └── AIPlayer.ts
│   │
│   ├── match-history-service/
│   ├── notification-service/
│   └── chat-service/
│
├── websocket-server/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.ts
│       ├── handlers/
│       ├── middleware/
│       └── utils/
│
└── database/
    ├── migrations/
    │   ├── 001_initial_schema.sql
    │   ├── 002_add_oauth.sql
    │   ├── 003_add_2fa.sql
    │   └── 004_add_tournaments.sql
    ├── seeds/
    │   └── dev_users.sql
    └── init.sh
```

---

## 8. Mandatory Requirements vs. Optional Modules

### 8.1 Mandatory Requirements (25% - Must Implement)

These features are **required** regardless of module selection:

| Requirement | Description | Implementation Status |
|-------------|-------------|----------------------|
| **Local 2-Player Game** | Same-keyboard Pong with W/S and Arrow keys | ✅ Documented |
| **Tournament System** | Alias-based registration, bracket generation, matchmaking | ✅ Documented |
| **Docker Deployment** | Single command launch (`docker-compose up`) | ✅ Implemented |
| **HTTPS Everywhere** | SSL/TLS encryption, secure WebSocket (wss://) | ✅ Implemented |
| **Security Measures** | Password hashing, SQL injection prevention, XSS protection | ✅ Documented |
| **Input Validation** | All forms and user input validated | ✅ Documented |
| **SPA with Routing** | Single-page app with back/forward browser support | ✅ Implemented |
| **Firefox Compatible** | Latest stable Mozilla Firefox | ✅ Target browser |
| **Identical Paddle Speeds** | All players (human/AI) have same movement speed | ✅ Documented |

**Key Points:**
- Local game and tournament **DO NOT require** user accounts
- These features work **immediately** without any module implementation
- Modules **enhance** these features but don't replace them

### 8.2 Module Implementation Plan

**Minimum Requirement:** 7 Major Modules (70%) + 25% Mandatory = **95% to pass**

#### **Implemented Modules:**

| # | Module | Type | Points | Status | Notes |
|---|--------|------|--------|--------|-------|
| 1 | Backend Framework (Fastify + Node.js) | Major | 10 | ✅ | Overrides PHP requirement |
| 2 | Database (SQLite) | Minor | 5 | ✅ | Required by framework module |
| 3 | Frontend (TailwindCSS + TypeScript) | Minor | 5 | ✅ | Enhanced mandatory frontend |
| 4 | Standard User Management | Major | 10 | ✅ | Auth, profiles, friends, stats |
| 5 | Remote Authentication (OAuth 2.0) | Major | 10 | ✅ | Google, GitHub, 42 Intra |
| 6 | Remote Players | Major | 10 | ✅ | Network multiplayer |
| 7 | AI Opponent | Major | 10 | ✅ | 1-second constraint |
| 8 | 2FA + JWT | Major | 10 | ✅ | TOTP, secure sessions |
| 9 | Microservices Backend | Major | 10 | ✅ | Service decomposition |
| 10 | User/Game Stats Dashboard | Minor | 5 | ✅ | Analytics & metrics |

**Score Calculation:**
- Mandatory: 25%
- Major Modules: 7 × 10 = 70%
- Minor Modules: 3 × 5 = 15% (= 1.5 major)
- **Total: 8.5 Major Equivalents = 110%**

**Minimum Achieved:** ✅ Exceeds 7 major modules requirement

### 8.3 Module Dependencies

```
┌─────────────────────────────────────────────────────────┐
│                  MANDATORY FEATURES                     │
│  (Work WITHOUT any modules)                            │
│  • Local 2-Player Game                                 │
│  • Tournament System (alias-based)                     │
│  • Docker Deployment                                   │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              TECHNOLOGY OVERRIDES                       │
│  (Change default tech stack)                           │
│  • Backend Framework Module → Fastify replaces PHP     │
│  • Frontend Module → TailwindCSS + TypeScript          │
│  • Database Module → SQLite (required by framework)    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│           USER MANAGEMENT FOUNDATION                    │
│  (Enables persistent accounts)                         │
│  • Standard User Management Module                     │
│    ├─→ Enables: Remote Authentication Module           │
│    ├─→ Enables: 2FA + JWT Module                       │
│    └─→ Enhances: Tournament system with persistence    │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│             GAME MODE ENHANCEMENTS                      │
│  (Add new ways to play)                                │
│  • Remote Players Module                               │
│  • AI Opponent Module                                  │
│  • Stats Dashboard Module                              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│          ARCHITECTURAL ENHANCEMENTS                     │
│  (Backend structure)                                   │
│  • Microservices Backend Module ✅ IMPLEMENTED         │
└─────────────────────────────────────────────────────────┘
```

**Dependency Rules:**
1. **Database module** is required when using Backend Framework module ✅
2. **Standard User Management** is required for:
   - Remote Authentication (OAuth 2.0) ✅
   - 2FA + JWT ✅
   - Persistent tournament history ✅
3. **Remote Players module** recommended before Multiplayer (4+ players)
4. **Backend Framework** recommended before Microservices module ✅

### 8.4 Implementation Phases

**Phase 1: Mandatory Baseline (COMPLETED)**
```
✅ Docker setup
✅ Nginx HTTPS reverse proxy
✅ Frontend SPA with routing
✅ Local 2-player game (client-side only)
✅ Tournament system (alias-based, no persistence)
✅ Security measures (hashing, validation, HTTPS)
```

**Phase 2: Module Foundation (COMPLETED)**
```
✅ Backend Framework (Fastify + Node.js)
✅ Database (SQLite)
✅ Microservices architecture
✅ API Gateway
✅ WebSocket Server
✅ All backend features migrated to microservices
```

**Phase 3: User Management (COMPLETED)**
```
✅ Auth Service (registration, login)
✅ User Service (profiles, friends)
✅ OAuth 2.0 (Google, GitHub, 42)
✅ 2FA + JWT
✅ Tournament persistence with user accounts
```

**Phase 4: Game Features (COMPLETED)**
```
✅ Remote multiplayer game mode
✅ AI opponent (with 1-second constraint)
✅ Game Service
✅ Stats dashboard
```

**Phase 5: Cleanup & Production (COMPLETED)**
```
✅ Removed legacy backend service
✅ Updated documentation
✅ All features tested and validated
✅ Production-ready microservices architecture
```

---

## 9. Security Implementation

### 9.1 Password Security
- bcrypt hashing (cost factor: 12)
- Minimum password requirements (8 chars, uppercase, number, symbol)
- Password strength meter on frontend
- Secure password reset with expiring tokens

### 9.2 SQL Injection Prevention
- Parameterized queries only
- Input validation with JSON Schema
- No dynamic SQL construction

### 9.3 XSS Prevention
- Output encoding for all user-generated content
- Content-Security-Policy headers
- Sanitize HTML in chat messages
- React-like framework auto-escaping (or manual escaping in vanilla TS)

### 9.4 CSRF Protection
- SameSite=Strict cookies for refresh tokens
- JWT in Authorization header (not cookies) for stateless API

### 9.5 Rate Limiting
```typescript
// API Gateway
const rateLimiter = {
  login: { max: 5, window: '15m' },
  register: { max: 3, window: '1h' },
  api: { max: 100, window: '1m' },
  websocket: { max: 10, window: '10s' }
};
```

### 9.6 HTTPS Enforcement
- Nginx redirects all HTTP → HTTPS
- HSTS header (Strict-Transport-Security)
- Secure cookies (Secure, HttpOnly flags)

---

## 10. Performance Considerations

### 10.1 Frontend
- Code splitting (lazy load pages)
- Asset optimization (minify, compress)
- Image optimization (WebP format)
- Caching strategy (service workers)

### 10.2 Backend
- Database indexing (user_id, email, game_id)
- Connection pooling
- Query optimization
- Response caching for static data (user profiles)

### 10.3 WebSocket
- Binary protocol for game state (reduce bandwidth)
- Client interpolation (smooth rendering between updates)
- Event throttling (debounce rapid inputs)

### 10.4 Game Engine
- Server tick rate: 60 TPS
- Client render rate: 60 FPS
- Physics timestep: 16.67ms (1/60)
- Collision detection: AABB (Axis-Aligned Bounding Box)

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Service logic (auth, game engine, AI)
- Utility functions
- API endpoint handlers

### 11.2 Integration Tests
- API Gateway → Microservices
- Database interactions
- OAuth flow
- 2FA flow

### 11.3 E2E Tests
- User registration → login → play game
- Tournament flow
- Friend system

### 11.4 Load Tests
- WebSocket concurrency (1000+ connections)
- API throughput (1000 req/s)
- Database query performance

---

## 12. Monitoring & Logging

### 12.1 Logging
- Structured JSON logs (Pino)
- Log levels: error, warn, info, debug
- Centralized logging (ELK stack - optional module)

### 12.2 Metrics
- API response times
- WebSocket connection count
- Active games count
- Database query performance

### 12.3 Alerts
- Service health checks
- Error rate thresholds
- Disk space monitoring

---

## 13. Future Scaling

### 13.1 Horizontal Scaling
- Load balancer (Nginx)
- Multiple API Gateway instances
- Microservice replication
- WebSocket server clustering (Socket.IO Redis adapter)

### 13.2 Database Scaling
- Migrate SQLite → PostgreSQL
- Read replicas
- Caching layer (Redis)

### 13.3 CDN
- Static asset distribution
- Global edge caching

---

## 14. Development Workflow

### 14.1 Local Development
```bash
# Start all services
docker-compose up

# Rebuild after code changes
docker-compose up --build

# View logs
docker-compose logs -f game-service

# Shell into service
docker-compose exec game-service sh
```

### 14.2 Environment Variables
```bash
# .env file
JWT_SECRET=<generate-with-openssl>
OAUTH_GOOGLE_ID=<from-google-console>
OAUTH_GOOGLE_SECRET=<from-google-console>
DATABASE_URL=/data/db.sqlite
FRONTEND_URL=https://localhost
```

### 14.3 Database Migrations
```bash
# Run migrations
npm run migrate

# Rollback
npm run migrate:rollback

# Seed dev data
npm run seed
```

---

## 15. API Documentation

### 15.1 Swagger/OpenAPI
- Auto-generated from Fastify schemas
- Available at: `https://localhost/api/documentation`
- Interactive API testing

### 15.2 Example Endpoints

**Authentication:**
```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/oauth/google
POST   /api/auth/2fa/enable
POST   /api/auth/2fa/verify
POST   /api/auth/refresh
```

**Users:**
```
GET    /api/users/me
PUT    /api/users/me
GET    /api/users/:id
GET    /api/users/search?q=username
POST   /api/users/avatar
GET    /api/users/:id/stats
```

**Friends:**
```
POST   /api/friends/request
POST   /api/friends/accept/:id
DELETE /api/friends/:id
GET    /api/friends
POST   /api/friends/block/:id
```

**Games:**
```
POST   /api/games/create
GET    /api/games/:id
POST   /api/games/matchmaking
GET    /api/games/history
```

**Tournaments:**
```
POST   /api/tournaments/create
POST   /api/tournaments/:id/join
GET    /api/tournaments/:id
```

---

## 16. Summary

### 16.1 Architecture Overview

This architecture provides:

✓ **Microservices backend** (modular, scalable, maintainable)
✓ **Comprehensive user management** (auth, OAuth, 2FA, profiles, friends)
✓ **Multiple game modes** (local, multiplayer, AI, tournaments)
✓ **Real-time communication** (WebSocket for game state, chat, notifications)
✓ **Security-first design** (HTTPS, JWT, hashing, validation, rate limiting)
✓ **Database-driven** (persistent state, match history, statistics)
✓ **Docker deployment** (single command: `docker-compose up`)
✓ **Scalable foundation** (horizontal scaling ready)

### 16.2 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | TypeScript + Vite + TailwindCSS | SPA with reactive UI |
| **API Gateway** | Fastify + Node.js | Request routing, JWT verification |
| **Microservices** | Fastify + Node.js | Auth, User, Game services |
| **WebSocket** | Socket.IO | Real-time bidirectional communication |
| **Database** | SQLite + better-sqlite3 | Persistent data storage |
| **Reverse Proxy** | Nginx | HTTPS termination, routing |
| **Authentication** | JWT + OAuth 2.0 + TOTP | Secure user sessions |
| **Deployment** | Docker + Docker Compose | Container orchestration |

### 16.3 Compliance Summary

**Subject Requirements:**
- ✅ **Mandatory Features (25%):** Local game, tournaments, Docker, HTTPS, security
- ✅ **Module Requirements (70%):** 7+ major modules implemented
- ✅ **Total Score:** 110% (8.5 major module equivalents)

**Technology Constraints:**
- ✅ **Frontend:** TypeScript + TailwindCSS (per subject)
- ✅ **Backend:** Fastify + Node.js (overrides PHP via module)
- ✅ **Database:** SQLite (required by framework module)
- ✅ **Browser:** Mozilla Firefox (latest stable)
- ✅ **Deployment:** Docker (single command)
- ✅ **Domain:** Custom domain (`ft_transcendence.42.crea`) ✅ **NOT localhost**

**Security Compliance:**
- ✅ Password hashing (bcrypt, rounds: 12)
- ✅ SQL injection prevention (parameterized queries)
- ✅ XSS prevention (input sanitization, CSP headers)
- ✅ HTTPS everywhere (wss:// for WebSocket)
- ✅ Rate limiting (login, API, WebSocket)
- ✅ CSRF protection (SameSite cookies)

### 16.4 Current Project State

**Status:** ✅ **Microservices Architecture Fully Operational**

**Completed:**
- Microservices architecture established
- API Gateway operational
- Auth, User, Game services deployed
- WebSocket server functional
- Frontend integrated with microservices
- All backend functionality migrated to microservices
- Legacy monolithic backend removed
- Documentation updated
- System tested and validated

**Production Ready:**
- All services operational and tested
- Comprehensive API routing through gateway
- Real-time communication via WebSocket
- Secure authentication with OAuth 2.0 + 2FA
- Performance optimized

**Next Steps:**
1. Continue feature development
2. Monitor performance metrics
3. Scale services as needed
4. Implement additional optional modules

---

**Document Version:** 3.0
**Last Updated:** 2025-01-07
**Project:** ft_transcendence (42 School)
**Architecture:** Microservices (Production)
**Migration Status:** Complete ✅
