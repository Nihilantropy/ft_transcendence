# SmartBreeds - Architecture Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Microservices Architecture](#microservices-architecture)
3. [AI/ML Services Architecture](#aiml-services-architecture)
4. [Service Communication](#service-communication-architecture)
5. [Authentication Flow](#authentication-flow)
6. [Technology Stack](#technology-stack--rationale)
7. [Data Flow & Integration](#data-flow--integration-patterns)
8. [Database Architecture](#database-architecture)
9. [Deployment Architecture](#deployment-architecture)
10. [Architecture Summary](#architecture-summary)

---

## Architecture Overview

SmartBreeds uses a **microservices architecture** with clear separation of concerns. The system is divided into specialized services that communicate via REST APIs, orchestrated through a central API Gateway. This design provides scalability, maintainability, and allows independent deployment of services.

### Core Design Principles

- **Separation of concerns**: Each microservice handles a specific domain (auth, users, AI vision, ML recommendations, RAG)
- **API Gateway pattern**: Single entry point for clients, handles routing, authentication, and request validation
- **Stateless services**: Services don't maintain session state, enabling horizontal scaling
- **HTTP-only JWT cookies**: Secure authentication without exposing tokens to client-side JavaScript

### High-Level Service Layers

1. **Presentation Layer**: React frontend served via Nginx
2. **Gateway Layer**: FastAPI API Gateway (request routing, JWT validation, rate limiting)
3. **Business Logic Layer**: Django microservices (auth, users, backend)
4. **AI/ML Layer**: Specialized AI services (Ollama for vision, RAG for knowledge, ML for recommendations)
5. **Data Layer**: PostgreSQL (persistent storage) and Redis (caching, sessions)

### Network Topology

- **Proxy Network**: Frontend ↔ API Gateway ↔ Nginx (public-facing)
- **Backend Network**: API Gateway ↔ Microservices (internal only)
- Services communicate only through defined REST APIs, never direct database access across service boundaries

---

## Microservices Architecture

### 1. Frontend (React + Vite)

- **Purpose**: User interface for pet image upload, breed identification, chat, and product recommendations
- **Technology**: React 19.2, Vite, Tailwind CSS
- **Communication**: REST API calls to API Gateway only
- **Deployment**: Served as static files via Nginx

### 2. API Gateway (FastAPI)

- **Purpose**: Single entry point, request routing, JWT validation, rate limiting
- **Technology**: FastAPI (Python async), Pydantic for validation
- **Key Responsibilities**:
  - Validate HTTP-only JWT cookies on incoming requests
  - Extract user context (user_id, roles) from JWT
  - Forward requests to appropriate microservices with user context in headers
  - Aggregate responses when needed
  - Handle CORS, rate limiting, request logging
- **Why FastAPI**: Extremely fast (async), minimal overhead, perfect for high-throughput routing

### 3. Auth Service (Django)

- **Purpose**: User authentication, registration, JWT token management
- **Technology**: Django 6.0.1, Django REST Framework, PyJWT
- **Key Responsibilities**:
  - User registration and login
  - Issue HTTP-only JWT cookies (secure, httpOnly, sameSite flags)
  - Token refresh logic
  - Password hashing (bcrypt/argon2)
- **Database**: PostgreSQL (users table)

### 4. User Service (Django)

- **Purpose**: User profile management, pet profiles
- **Technology**: Django 6.0.1, Django REST Framework
- **Key Responsibilities**:
  - CRUD operations for user profiles
  - Pet profiles (name, breed, age, weight, health conditions)
  - User preferences and settings
- **Database**: PostgreSQL (profiles, pets tables)

---

## AI/ML Services Architecture

### 5. Vision Service (Ollama)

- **Purpose**: AI-powered image recognition and breed classification
- **Technology**: Ollama server hosting `qwen3-vl:8b` multimodal model
- **Key Responsibilities**:
  - Accept pet images from API Gateway
  - Perform breed identification and classification
  - Generate breed descriptions and characteristics
  - Analyze pedigree documentation (images/documents)
- **Why Ollama**: Open-source, self-hosted, GPU-accelerated, no API costs. Direct interface for vision models.
- **API Endpoint**: `POST /api/v1/analyze` - accepts image, returns breed data
- **Communication**: REST API, internal network only

### 6. AI Service (FastAPI + LlamaIndex + scikit-learn)

**Purpose**: Unified AI service handling all intelligent features through LlamaIndex

**Technology Stack**:
- **FastAPI**: REST API framework (async, high-performance)
- **LlamaIndex Core**: Orchestration framework for all AI operations
- **llama-index-llms-ollama**: Connect to Ollama for LLM and vision queries
- **llama-index-embeddings-huggingface**: Generate embeddings (e.g., `sentence-transformers/all-MiniLM-L6-v2`)
- **llama-index-readers-file**: Ingest PDFs, docs, markdown for RAG
- **ChromaDB**: Vector storage for embeddings
- **scikit-learn**: ML algorithms for product scoring
- **pandas/numpy**: Data processing

#### A) Vision Analysis (Breed Identification)

- **Endpoint**: `POST /api/v1/vision/analyze`
- **Flow**:
  1. Receive pet image from API Gateway
  2. Use LlamaIndex's multimodal capabilities to send image to Ollama (`qwen3-vl:8b`)
  3. Parse breed identification, characteristics, confidence scores
  4. Return structured breed data
- **LlamaIndex Role**: Unified interface for multimodal queries, consistent error handling

#### B) RAG System (Pet Health Knowledge Base)

- **Endpoints**:
  - `POST /api/v1/rag/query` - Ask questions about pet health, breed info
  - `POST /api/v1/rag/ingest` - Add documents to knowledge base (admin)
- **Flow**:
  1. **Ingestion**: `FileReader` loads PDFs/docs → chunk → embed → store in ChromaDB
  2. **Query**: User question → embed → semantic search → retrieve context → LlamaIndex query engine → Ollama generates answer
- **LlamaIndex Components**:
  - `VectorStoreIndex`: Manages embeddings and retrieval
  - `QueryEngine`: Orchestrates retrieval + generation
  - `ServiceContext`: Configures LLM (Ollama) and embedding model
- **Data Sources**: Veterinary guides, breed standards, nutrition facts, health condition databases

#### C) ML-Enhanced Product Recommendations

- **Endpoint**: `POST /api/v1/recommendations`
- **Flow** (Hybrid ML + RAG):
  1. **ML Scoring Phase**:
     - Extract breed characteristics (size, energy, health predispositions)
     - Load product catalog with attributes
     - scikit-learn feature matching: breed traits → product suitability scores
     - Rank top-N products
  2. **LlamaIndex Enhancement Phase**:
     - Query RAG for breed-specific needs: "What are Golden Retriever dietary requirements?"
     - For each top product, use LlamaIndex to generate natural language explanation
     - Example: "We recommend Royal Canin Large Breed because Golden Retrievers are prone to hip dysplasia and need glucosamine-rich food with controlled calcium levels for joint health."
  3. Return: `{products: [...], scores: [...], explanations: [...]}`
- **Why This Approach**: Combines objective ML scoring with interpretable, context-aware explanations. Users understand WHY products are recommended.

**Architecture Benefits**:
- **Single AI Container**: Easier deployment, shared dependencies, unified LlamaIndex configuration
- **Consistent Interface**: All AI features use LlamaIndex patterns (queries, embeddings, LLM calls)
- **Ollama Abstraction**: LlamaIndex handles Ollama connection pooling, retries, error handling
- **Explainable AI**: ML provides accuracy, RAG provides transparency

---

## Service Communication Architecture

### Communication Pattern: REST APIs

All microservices communicate via **synchronous REST APIs** over HTTP. This provides:
- **Simplicity**: Standard HTTP methods (GET, POST, PUT, DELETE)
- **Debugging**: Easy to trace, log, and monitor
- **Tooling**: Extensive ecosystem (Postman, OpenAPI, curl)
- **Statelessness**: Each request contains all necessary information

### Network Topology

**Two isolated Docker networks:**

1. **Proxy Network** (Public-facing):
   - Nginx ↔ Frontend (static files)
   - Nginx ↔ API Gateway (REST)
   - **No direct backend access**

2. **Backend Network** (Internal only):
   - API Gateway ↔ Auth Service
   - API Gateway ↔ User Service
   - API Gateway ↔ AI Service
   - AI Service ↔ Ollama
   - All services ↔ PostgreSQL
   - All services ↔ Redis (optional caching)

**Key principle**: Backend services are NOT exposed externally. Only API Gateway bridges the two networks.

### Request Flow Example: Pet Image Analysis

```
1. User uploads image → React Frontend
2. Frontend → POST /api/v1/pets/analyze (to Nginx)
3. Nginx → API Gateway (validates HTTPS, forwards request)
4. API Gateway:
   - Extracts JWT from HTTP-only cookie
   - Validates signature, expiration
   - Extracts user_id from JWT payload
   - Forwards to AI Service with headers:
     X-User-ID: 12345
     X-User-Role: user
5. AI Service → Ollama (vision analysis)
6. AI Service → Response: {breed, confidence, traits}
7. API Gateway → Frontend (JSON response)
8. Frontend renders breed results
```

### Inter-Service Communication Standards

**Headers passed by API Gateway to backend services:**
- `X-User-ID`: Authenticated user ID (string)
- `X-User-Role`: User role (user, admin)
- `X-Request-ID`: Unique request ID for tracing (UUID)
- `X-Correlation-ID`: For multi-service request tracking

**Response format (all services):**
```json
{
  "success": true,
  "data": { /* payload */ },
  "error": null,
  "timestamp": "2026-01-13T10:30:00Z"
}
```

**Error format:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "BREED_NOT_FOUND",
    "message": "Unable to identify breed from image",
    "details": {}
  },
  "timestamp": "2026-01-13T10:30:00Z"
}
```

---

## Authentication Flow

### Why HTTP-Only JWT Cookies?

- **Security**: Token not accessible to JavaScript (XSS protection)
- **Automatic**: Browser sends cookie with every request
- **CSRF Protection**: Combined with SameSite attribute
- **Stateless**: JWT contains all user context, no server-side sessions

### JWT Token Structure

**Payload:**
```json
{
  "user_id": "12345",
  "email": "user@example.com",
  "role": "user",
  "iat": 1705140000,
  "exp": 1705226400
}
```

**Cookie Attributes:**
- `httpOnly`: true (no JavaScript access)
- `secure`: true (HTTPS only)
- `sameSite`: "Strict" (CSRF protection)
- `maxAge`: 24 hours (access token)
- `path`: "/"

### Authentication Flows

#### 1. Registration Flow

```
1. User → Frontend: Fill registration form
2. Frontend → API Gateway: POST /api/v1/auth/register
   Body: {email, password, name}
3. API Gateway → Auth Service: Forward request
4. Auth Service:
   - Validate email format, password strength
   - Hash password (bcrypt/argon2)
   - Create user in PostgreSQL
   - Generate JWT access token (24h) and refresh token (7d)
   - Set HTTP-only cookies
5. Response → Frontend: {success: true, user: {id, email, name}}
   Set-Cookie: access_token=xxx; HttpOnly; Secure; SameSite=Strict
   Set-Cookie: refresh_token=yyy; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh
```

#### 2. Login Flow

```
1. User → Frontend: Enter credentials
2. Frontend → API Gateway: POST /api/v1/auth/login
   Body: {email, password}
3. API Gateway → Auth Service: Forward request
4. Auth Service:
   - Query user by email
   - Verify password hash
   - Generate JWT tokens (access + refresh)
   - Set HTTP-only cookies
5. Response → Frontend: {success: true, user: {id, email, name}}
   Set-Cookie: access_token=xxx; HttpOnly; Secure; SameSite=Strict
   Set-Cookie: refresh_token=yyy; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh
```

#### 3. Authenticated Request Flow

```
1. Frontend → API Gateway: GET /api/v1/pets
   Cookie: access_token=xxx (automatically sent by browser)
2. API Gateway:
   - Extract access_token from cookie
   - Verify JWT signature (using shared secret/public key)
   - Check expiration
   - Extract user_id and role from payload
   - Forward to User Service with headers:
     X-User-ID: 12345
     X-User-Role: user
3. User Service:
   - Trusts API Gateway validation
   - Uses X-User-ID for authorization
   - Query user's pets from database
4. Response → Frontend: {success: true, data: [pets]}
```

#### 4. Token Refresh Flow

```
1. Frontend receives 401 Unauthorized (access token expired)
2. Frontend → API Gateway: POST /api/v1/auth/refresh
   Cookie: refresh_token=yyy (automatically sent)
3. API Gateway → Auth Service: Forward request
4. Auth Service:
   - Validate refresh token
   - Check if user still exists and is active
   - Generate new access token (24h)
   - Generate new refresh token (7d) - rotation for security
   - Set new cookies
5. Response → Frontend: {success: true}
   Set-Cookie: access_token=new_xxx; HttpOnly; Secure; SameSite=Strict
   Set-Cookie: refresh_token=new_yyy; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh
6. Frontend retries original request with new token
```

#### 5. Logout Flow

```
1. Frontend → API Gateway: POST /api/v1/auth/logout
2. API Gateway → Auth Service: Forward request
3. Auth Service:
   - (Optional) Add token to blacklist in Redis with TTL
   - Clear cookies
4. Response → Frontend: {success: true}
   Set-Cookie: access_token=; MaxAge=0
   Set-Cookie: refresh_token=; MaxAge=0
```

### Security Considerations

**API Gateway Validation:**
- JWT signature verification using shared secret (HS256) or public key (RS256)
- Expiration check: reject if `exp` < current time
- Optional: Check token blacklist in Redis for logged-out tokens

**Backend Services:**
- **Trust but verify**: Services trust X-User-ID headers from API Gateway
- Network isolation ensures only API Gateway can set these headers
- Optional: Services can validate a signed header from gateway for extra security

**Token Storage:**
- **Secret Key**: Store JWT signing secret in environment variables, never in code
- **Key Rotation**: Plan for periodic secret rotation with grace period

---

## Technology Stack & Rationale

### Frontend Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **React** | 19.2 | UI framework | Latest version, excellent ecosystem, component reusability, virtual DOM performance |
| **Vite** | Latest | Build tool & dev server | Extremely fast HMR, modern ES modules, better DX than Webpack |
| **Tailwind CSS** | Latest | Utility-first CSS | Rapid UI development, consistent design system, smaller bundle than component libraries |
| **Axios/Fetch** | - | HTTP client | Clean API for REST calls, automatic cookie handling |

### API Gateway Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **FastAPI** | Latest | Gateway framework | Async/await for high concurrency, 3-5x faster than Django for routing, automatic OpenAPI docs, minimal overhead |
| **Pydantic** | Latest | Request validation | Type-safe validation, automatic error messages, integrates with FastAPI |
| **PyJWT** | Latest | JWT handling | Standard library for JWT operations, signature verification |
| **uvicorn** | Latest | ASGI server | High-performance async server for FastAPI |

### Backend Services Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **Django** | 6.0.1 | Backend framework | Batteries-included, excellent ORM, admin panel, mature ecosystem, security features built-in |
| **Django REST Framework** | Latest | REST API toolkit | Serializers, viewsets, authentication, browsable API for development |
| **PostgreSQL** | 15+ | Primary database | ACID compliance, JSON support, full-text search, proven reliability |
| **Redis** | Latest | Caching & sessions | In-memory speed for token blacklist, session storage, API rate limiting |

### AI/ML Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **Ollama** | Latest | LLM hosting | Self-hosted, GPU-accelerated, no API costs, supports multimodal models |
| **qwen3-vl:8b** | - | Vision model | Multimodal (vision + language), 8B params balanced performance/resource, breed identification capable |
| **LlamaIndex** | Latest | AI orchestration | Purpose-built for RAG, excellent Ollama integration, simpler than LangChain for our use case |
| **llama-index-llms-ollama** | Latest | Ollama connector | Direct integration with Ollama server |
| **llama-index-embeddings-huggingface** | Latest | Text embeddings | Access to sentence-transformers models (e.g., all-MiniLM-L6-v2) |
| **llama-index-readers-file** | Latest | Document ingestion | Load PDFs, docs, markdown for RAG knowledge base |
| **ChromaDB** | Latest | Vector database | Lightweight, embedded, no separate server needed, fast semantic search |
| **FastAPI** | Latest | AI service API | Async for ML inference, lightweight, consistent with gateway |
| **scikit-learn** | Latest | ML algorithms | Feature engineering, scoring, breed-product matching, proven and stable |
| **sentence-transformers** | Latest | Embedding model | High-quality semantic embeddings for RAG |

### Infrastructure Layer

| Technology | Version | Purpose | Why This Choice |
|------------|---------|---------|-----------------|
| **Nginx** | Latest | Reverse proxy | TLS termination, static file serving, request routing, proven reliability |
| **Docker** | Latest | Containerization | Consistent environments, easy deployment, service isolation |
| **Docker Compose** | Latest | Orchestration | Multi-container orchestration, network management, volume management |

### Development & Deployment

| Technology | Purpose | Why This Choice |
|------------|---------|-----------------|
| **Git** | Version control | Industry standard, branching, collaboration |
| **pytest** | Testing (Python) | Simple, powerful, fixtures, async support |
| **Vitest** | Testing (Frontend) | Fast, Vite-native, Jest-compatible API |
| **Black** | Code formatting (Python) | Opinionated, consistent, no config needed |

### Key Architecture Decisions

**Why Microservices?**
- Independent scaling (AI service needs GPU, others don't)
- Technology flexibility (FastAPI for gateway, Django for business logic)
- Team autonomy (different teams can own different services)
- Fault isolation (AI service crash doesn't affect auth)

**Why REST over GraphQL?**
- Simpler for small-medium teams
- Better caching (HTTP standard)
- Easier debugging and monitoring
- Sufficient for our use case (no complex nested queries)

**Why HTTP-Only Cookies over localStorage?**
- XSS protection (tokens not accessible to JavaScript)
- Automatic transmission (no manual header management)
- Better security posture for sensitive data

**Why LlamaIndex over LangChain?**
- More focused on RAG use cases
- Better Ollama integration out of the box
- Simpler API for our needs
- Less bloat, easier to maintain

---

## Data Flow & Integration Patterns

### End-to-End Flow: Pet Breed Identification with Product Recommendations

This example demonstrates how all services interact for a complete user journey:

```
1. USER ACTION: Upload pet image
   └─> Frontend (React)

2. API CALL: POST /api/v1/pets/analyze
   └─> Nginx (HTTPS, port 443)
       └─> API Gateway (FastAPI)
           ├─> Extract JWT from HTTP-only cookie
           ├─> Validate token signature & expiration
           ├─> Extract user_id: 12345
           └─> Forward with headers: X-User-ID: 12345

3. VISION ANALYSIS:
   └─> AI Service: POST /vision/analyze
       ├─> LlamaIndex multimodal query
       └─> Ollama (qwen3-vl:8b)
           └─> Returns: {breed: "Golden Retriever", confidence: 0.95, traits: {...}}

4. RAG ENHANCEMENT:
   └─> AI Service internal call: /rag/query
       ├─> Query: "What are Golden Retriever characteristics and health needs?"
       ├─> LlamaIndex QueryEngine
       │   ├─> Embed query (HuggingFace embeddings)
       │   ├─> Search ChromaDB for relevant docs
       │   └─> Retrieve context: breed standards, health info
       └─> Ollama generates structured response

5. ML RECOMMENDATIONS:
   └─> AI Service internal call: /recommendations
       ├─> scikit-learn feature matching
       │   ├─> Input: breed traits (size: large, energy: high, health: hip dysplasia risk)
       │   └─> Score products: foods, toys, supplements
       ├─> Top 10 products selected
       └─> LlamaIndex generates explanations using RAG context
           └─> "Recommended because Golden Retrievers need glucosamine for joint health..."

6. SAVE TO DATABASE:
   └─> API Gateway: POST /api/v1/user-service/pets
       └─> User Service (Django)
           ├─> Headers: X-User-ID: 12345
           ├─> Save pet profile to PostgreSQL
           └─> Link: user_id → pet_id → breed_data

7. RESPONSE TO FRONTEND:
   └─> API Gateway aggregates responses
       └─> Returns JSON:
           {
             "breed": "Golden Retriever",
             "confidence": 0.95,
             "traits": {...},
             "health_info": {...},
             "recommendations": [
               {
                 "product": "Royal Canin Large Breed",
                 "score": 0.92,
                 "explanation": "..."
               }
             ]
           }

8. UI UPDATE:
   └─> Frontend renders:
       ├─> Breed identification card
       ├─> Health information panel
       └─> Product recommendations carousel
```

### Integration Patterns

#### Pattern 1: Gateway Aggregation

**Use Case**: Single frontend request needs data from multiple services

**Example**: User dashboard showing pets + recent activity + recommendations
```
Frontend → API Gateway → Parallel calls:
  ├─> User Service: GET /users/{id}/pets
  ├─> AI Service: GET /recent-analyses/{user_id}
  └─> AI Service: GET /recommendations/{user_id}
Gateway aggregates responses → Single JSON to frontend
```

**Benefits**: Reduces frontend complexity, fewer round trips, consistent error handling

#### Pattern 2: Service-to-Service (via Gateway)

**Use Case**: AI Service needs user context for personalized responses

**Example**: RAG query considers user's pet breeds
```
AI Service needs user's pets
  └─> AI Service → API Gateway → User Service
      ├─> Internal service auth (shared secret or JWT)
      └─> Returns: user's pet list
AI Service customizes RAG context → Better recommendations
```

**Benefits**: Maintains service boundaries, centralized auth, audit trail

#### Pattern 3: Async Processing (Future Enhancement)

**Use Case**: Long-running ML training or batch recommendations

**Flow**:
```
1. User triggers recommendation refresh
2. API Gateway → AI Service: POST /batch-recommendations
3. AI Service:
   ├─> Returns immediately: {job_id: "abc123", status: "processing"}
   ├─> Async worker processes recommendations
   └─> Updates PostgreSQL when complete
4. Frontend polls: GET /jobs/abc123
   └─> Returns: {status: "completed", results: [...]}
```

**Implementation**: Use Celery + Redis or FastAPI BackgroundTasks

### Error Handling & Resilience

**Timeout Strategy:**
- API Gateway → Services: 30s timeout
- AI Service → Ollama: 60s timeout (vision inference can be slow)
- RAG queries: 15s timeout

**Retry Logic:**
- Idempotent GET requests: 3 retries with exponential backoff
- Non-idempotent POST/PUT: No automatic retry (client decides)
- Ollama failures: Retry once, then fallback to cached response or graceful degradation

**Circuit Breaker (Future):**
- If Ollama fails 5 times in 60s, open circuit for 5 minutes
- Return cached breed data or "Service temporarily unavailable"

**Graceful Degradation:**
- Vision service down → Allow manual breed selection
- RAG service down → Return basic breed info without enrichment
- ML recommendations down → Show popular products instead

---

## Database Architecture

### Database Strategy: Shared PostgreSQL with Service Ownership

**Approach**: Single PostgreSQL instance with **logical separation** by schema/namespace. Each service owns its tables and never directly accesses another service's tables.

**Why Shared Database?**
- Simpler for initial deployment and development
- ACID transactions within service boundaries
- Easier backup and maintenance
- Lower infrastructure overhead
- Services communicate via APIs, not direct DB access

**Future Scaling**: Can split into separate databases per service if needed (microservices best practice for large scale)

### Database Schemas

#### Auth Service Schema (`auth_schema`)

**Table: users**
```sql
- id (UUID, primary key)
- email (VARCHAR, unique, indexed)
- password_hash (VARCHAR)
- is_active (BOOLEAN)
- is_verified (BOOLEAN)
- role (ENUM: 'user', 'admin')
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
```

**Table: refresh_tokens** (Optional: for token rotation tracking)
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key → users.id)
- token_hash (VARCHAR, indexed)
- expires_at (TIMESTAMP)
- revoked (BOOLEAN)
- created_at (TIMESTAMP)
```

**Indexes:**
- `idx_users_email` on users(email) - Fast login lookups
- `idx_refresh_tokens_hash` on refresh_tokens(token_hash) - Token validation
- `idx_refresh_tokens_user_expires` on refresh_tokens(user_id, expires_at) - Cleanup expired tokens

#### User Service Schema (`user_schema`)

**Table: user_profiles**
```sql
- id (UUID, primary key)
- user_id (UUID, unique, references auth_schema.users.id)
- first_name (VARCHAR)
- last_name (VARCHAR)
- phone (VARCHAR, nullable)
- address (JSONB, nullable)
- preferences (JSONB) -- UI settings, notification prefs
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Table: pets**
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key → user_profiles.user_id, indexed)
- name (VARCHAR)
- breed (VARCHAR)
- breed_confidence (FLOAT) -- From vision analysis
- species (ENUM: 'dog', 'cat', 'other')
- age (INTEGER, nullable) -- in months
- weight (FLOAT, nullable) -- in kg
- health_conditions (JSONB) -- Array of conditions
- image_url (VARCHAR, nullable)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Table: pet_analyses** (History of vision analyses)
```sql
- id (UUID, primary key)
- pet_id (UUID, foreign key → pets.id)
- user_id (UUID, indexed)
- image_url (VARCHAR)
- breed_detected (VARCHAR)
- confidence (FLOAT)
- traits (JSONB) -- Size, energy, temperament
- raw_response (JSONB) -- Full AI response
- created_at (TIMESTAMP)
```

**Indexes:**
- `idx_pets_user_id` on pets(user_id) - User's pet list
- `idx_pet_analyses_pet_id` on pet_analyses(pet_id) - Pet history
- `idx_pet_analyses_user_created` on pet_analyses(user_id, created_at DESC) - Recent analyses

#### AI Service Schema (`ai_schema`)

**Table: product_catalog**
```sql
- id (UUID, primary key)
- name (VARCHAR)
- category (ENUM: 'food', 'toy', 'accessory', 'health', 'grooming')
- brand (VARCHAR)
- description (TEXT)
- features (JSONB) -- Structured product attributes
- suitable_for (JSONB) -- {breeds: [], sizes: [], ages: []}
- price (DECIMAL)
- image_url (VARCHAR)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

**Table: recommendations** (Cache/history)
```sql
- id (UUID, primary key)
- user_id (UUID, indexed)
- pet_id (UUID, indexed)
- product_id (UUID, foreign key → product_catalog.id)
- score (FLOAT) -- ML confidence score
- explanation (TEXT) -- Generated by LlamaIndex
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP) -- Cache TTL
```

**Table: rag_documents** (Knowledge base metadata)
```sql
- id (UUID, primary key)
- title (VARCHAR)
- source (VARCHAR) -- File path or URL
- document_type (ENUM: 'breed_guide', 'health_info', 'nutrition', 'care')
- content_hash (VARCHAR, indexed) -- Detect duplicates
- chunk_count (INTEGER) -- Number of chunks in vector DB
- indexed_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

**Indexes:**
- `idx_product_catalog_category_active` on product_catalog(category, is_active) - Filter products
- `idx_recommendations_user_pet` on recommendations(user_id, pet_id, created_at DESC) - User recommendations
- `idx_rag_documents_type` on rag_documents(document_type) - Filter knowledge base

### Redis Cache Schema

**Key Patterns:**

```
# Token blacklist (logout)
blacklist:token:{token_hash} → "1" (TTL: remaining token lifetime)

# Rate limiting
rate_limit:user:{user_id}:{endpoint} → count (TTL: 1 minute)
rate_limit:ip:{ip_address} → count (TTL: 1 minute)

# Session cache (optional)
session:{session_id} → {user_id, last_active, ...} (TTL: 24h)

# API response cache
cache:breed:{breed_name} → {traits, health_info, ...} (TTL: 7 days)
cache:recommendations:{pet_id} → [products] (TTL: 24 hours)

# Ollama response cache (reduce inference costs)
ollama:vision:{image_hash} → {breed, confidence, ...} (TTL: 30 days)
```

### ChromaDB Collections (Vector Store)

**Collection: pet_knowledge**
```
- Vectors: 384-dimensional (all-MiniLM-L6-v2 embeddings)
- Metadata: {
    document_id: UUID,
    title: string,
    source: string,
    document_type: string,
    chunk_index: int
  }
- Documents: Text chunks (500 tokens each)
```

**Collection: breed_profiles** (Optional: Pre-indexed breed info)
```
- Vectors: 384-dimensional
- Metadata: {
    breed: string,
    species: string,
    traits: {...}
  }
- Documents: Comprehensive breed descriptions
```

### Data Relationships

```
users (auth) ←─────────┐
                       │
user_profiles (user) ───┤
    ↓                   │
  pets (user) ──────────┤
    ↓                   │
pet_analyses (user) ────┤
                        │
recommendations (ai) ───┘
    ↓
product_catalog (ai)

rag_documents (ai) → ChromaDB vectors
```

### Data Access Rules

1. **Service Isolation**:
   - Auth Service: READ/WRITE `auth_schema.*`
   - User Service: READ/WRITE `user_schema.*`, READ `auth_schema.users.id` (FK validation only)
   - AI Service: READ/WRITE `ai_schema.*`, READ `user_schema.pets.*` (via API Gateway only)

2. **Cross-Service Data Access**:
   - MUST go through REST APIs
   - NO direct database queries across schemas
   - Exception: Foreign key constraints for data integrity

3. **Data Ownership**:
   - Users own their profiles and pets
   - AI Service owns product catalog and recommendations
   - RAG documents are admin-managed

---

## Deployment Architecture

### Makefile Interface

**Primary interaction method** - All Docker operations through `make` commands:

```makefile
# Core commands
make build          # Build all Docker images (bakes in requirements)
make up             # Start all services
make down           # Stop all services
make restart        # Restart all services
make logs           # View logs (all services)
make logs-{svc}     # View specific service logs
make clean          # Stop and remove containers
make fclean         # Full clean (containers + volumes)
make re             # Rebuild and restart everything

# Database commands
make db-migrate     # Run database migrations
make db-backup      # Backup PostgreSQL database

# Health & monitoring
make health         # Check all service health

# Development helpers
make dev-frontend   # Run frontend in dev mode
make dev-ai         # Run AI service locally with dependencies
```

### Container Structure

```
ft_transcendence/
├── nginx (Reverse proxy, TLS termination)
├── frontend (React 19.2 + Vite, static build)
├── api-gateway (FastAPI, port 8001)
├── auth-service (Django 6.0.1, port 3001)
├── user-service (Django 6.0.1, port 3002)
├── ai-service (FastAPI + LlamaIndex, port 3003)
├── ollama (Ollama server, port 11434, GPU-enabled)
├── postgres (PostgreSQL 15+, port 5432)
└── redis (Redis latest, port 6379)
```

### Custom Dockerfiles

Each service has a custom Dockerfile that **inherits from base images** and **bakes in requirements**:

#### Example: API Gateway Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy and install requirements (baked into image)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd -m -u 1000 gateway && chown -R gateway:gateway /app
USER gateway

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=30s \
    CMD curl -f http://localhost:8001/health || exit 1

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "4"]
```

#### Example: AI Service Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for ML libraries
RUN apt-get update && apt-get install -y \
    curl gcc g++ build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements (includes LlamaIndex, scikit-learn)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model (baked into image)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')"

# Copy application code
COPY . .

# Create directories and non-root user
RUN mkdir -p /app/chroma_db /app/documents && \
    useradd -m -u 1000 aiuser && \
    chown -R aiuser:aiuser /app

USER aiuser

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=60s \
    CMD curl -f http://localhost:3003/health || exit 1

EXPOSE 3003

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3003", "--workers", "2"]
```

### Docker Networks

```yaml
networks:
  proxy:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
  backend-network:
    driver: bridge
    internal: true  # No external internet access
    ipam:
      config:
        - subnet: 172.21.0.0/16
```

**Network Isolation**:
- `proxy`: Frontend, Nginx, API Gateway (can reach internet)
- `backend-network`: All backend services, databases (isolated)
- API Gateway bridges both networks

### Docker Volumes

```yaml
volumes:
  postgres-data:          # PostgreSQL persistent data
  redis-data:             # Redis persistence (optional)
  ollama-models:          # Ollama model cache (~5GB for qwen3-vl:8b)
  chroma-data:            # ChromaDB vector store
  rag-documents:          # RAG source documents
  uploaded-images:        # User-uploaded pet images
```

### Environment Variables

**.env file structure**:
```bash
# Database
DB_USER=transcendence_user
DB_PASSWORD=<strong_password>
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/transcendence

# JWT
JWT_SECRET_KEY=<256-bit-secret>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE=86400
JWT_REFRESH_TOKEN_EXPIRE=604800

# Redis
REDIS_URL=redis://redis:6379/0

# Ollama
OLLAMA_BASE_URL=http://ollama:11434
LLM_MODEL=qwen3-vl:8b

# AI Service
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
CHROMA_PERSIST_DIR=/app/chroma_db

# Development
DEBUG=false
LOG_LEVEL=info
```

---

## Architecture Summary

### System Overview

SmartBreeds is a **microservices-based pet companion platform** that combines AI vision, RAG knowledge systems, and ML recommendations to help users identify pet breeds, access health information, and receive personalized product recommendations.

### Core Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Architecture Pattern** | Microservices | Independent scaling, technology flexibility, fault isolation |
| **API Gateway** | FastAPI | High performance (async), minimal overhead, perfect for routing |
| **Backend Services** | Django 6.0.1 | Batteries-included, excellent ORM, mature ecosystem |
| **Frontend** | React 19.2 + Vite | Modern, fast HMR, component reusability |
| **AI Orchestration** | LlamaIndex | Purpose-built for RAG, excellent Ollama integration |
| **Vision Model** | Ollama + qwen3-vl:8b | Self-hosted, GPU-accelerated, multimodal, no API costs |
| **Vector Store** | ChromaDB | Lightweight, embedded, fast semantic search |
| **ML Framework** | scikit-learn | Sufficient for breed-based matching, lightweight |
| **Database** | PostgreSQL 15+ | ACID compliance, JSON support, proven reliability |
| **Cache** | Redis | In-memory speed for tokens, rate limiting, caching |
| **Authentication** | HTTP-only JWT cookies | XSS protection, automatic transmission, stateless |
| **Communication** | REST APIs | Simple, debuggable, standard HTTP |
| **Deployment** | Docker + Makefile | Consistent environments, easy orchestration |

### Service Inventory

| Service | Technology | Port | Purpose |
|---------|-----------|------|---------|
| **Nginx** | Nginx Alpine | 80, 443 | Reverse proxy, TLS termination |
| **Frontend** | React 19.2 + Vite | - | User interface (static files) |
| **API Gateway** | FastAPI | 8001 | Request routing, JWT validation |
| **Auth Service** | Django 6.0.1 | 3001 | User authentication, registration |
| **User Service** | Django 6.0.1 | 3002 | Profile & pet management |
| **AI Service** | FastAPI + LlamaIndex | 3003 | Vision, RAG, ML recommendations |
| **Ollama** | Ollama Server | 11434 | LLM & vision model hosting |
| **PostgreSQL** | PostgreSQL 15 | 5432 | Primary database |
| **Redis** | Redis 7 | 6379 | Cache & token blacklist |

### Data Flow Summary

**Typical User Journey:**
1. User uploads pet image → Frontend
2. Frontend → Nginx → API Gateway (validates JWT)
3. API Gateway → AI Service (with user context)
4. AI Service → Ollama (vision analysis)
5. AI Service → RAG system (breed information)
6. AI Service → ML engine (product recommendations with explanations)
7. AI Service → API Gateway → Frontend (aggregated response)
8. User Service saves pet profile to PostgreSQL

### Security Architecture

- **Network Isolation**: Two-tier network (proxy + backend)
- **Authentication**: HTTP-only JWT cookies (XSS protection)
- **Authorization**: API Gateway validates, forwards user context
- **Token Management**: Access (24h) + Refresh (7d) tokens
- **Password Security**: bcrypt/argon2 hashing
- **HTTPS**: TLS 1.2+ with strong ciphers
- **Rate Limiting**: Redis-backed per-user/IP limits

### Scalability Considerations

**Current Architecture:**
- Suitable for 1K-10K users
- Single PostgreSQL instance
- Single Ollama GPU server
- Stateless services (horizontal scaling ready)

**Future Enhancements:**
- Database sharding/replication for high load
- Ollama load balancer for multiple GPU servers
- Redis cluster for distributed caching
- Async processing with Celery for batch jobs
- API Gateway rate limiting per tier
- CDN for static assets

### Development Principles

1. **YAGNI**: Build what's needed now, not hypothetical features
2. **Service Independence**: Each microservice owns its data and logic
3. **API-First**: Services communicate only through defined APIs
4. **Security by Design**: HTTP-only cookies, network isolation, JWT validation
5. **Performance**: FastAPI for gateways, Redis caching, GPU acceleration
6. **Maintainability**: Clear separation of concerns, consistent patterns
7. **Documentation**: OpenAPI specs, architecture docs, code comments

---

**Document Version**: 1.0
**Last Updated**: 2026-01-13
**Maintained By**: SmartBreeds Development Team
