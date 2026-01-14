# Architecture Overview - Production-Emulation Setup

## Network Topology

This setup emulates the production environment while maintaining development convenience.

```
                    INTERNET/LOCALHOST
                           ↓
    ┌──────────────────────────────────────────────────┐
    │  proxy network (Public-facing)                   │
    │                                                   │
    │  ┌─────────────────────────────────────────┐    │
    │  │  NGINX (ports 80/443)                   │    │
    │  │  - TLS termination                      │    │
    │  │  - Rate limiting                        │    │
    │  │  - Security headers                     │    │
    │  └──────────────┬──────────────────────────┘    │
    │                 │                                 │
    └─────────────────┼─────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────────────────────┐
    │  backend-network (Internal services)              │
    │                 ↓                                  │
    │  ┌──────────────────────────────────────┐        │
    │  │  API Gateway (port 8001)              │        │
    │  │  - JWT authentication                 │        │
    │  │  - Rate limiting (Redis)              │        │
    │  │  - Request logging                    │        │
    │  │  - Error handling                     │        │
    │  └──────────┬─────────────────────────────┘        │
    │             │                                       │
    │             ├─→ Redis (rate limiting)              │
    │             ├─→ Auth Service (future)              │
    │             ├─→ User Service (future)              │
    │             └─→ AI Service (future)                │
    └───────────────────────────────────────────────────┘
```

## Service Exposure

### Production-Like (Through NGINX)
```
User → https://localhost/api/* → NGINX → API Gateway → Backend Services
```

- ✅ Single public entry point (NGINX)
- ✅ TLS termination at NGINX
- ✅ NGINX rate limiting + API Gateway rate limiting (dual protection)
- ✅ Centralized logging at NGINX
- ✅ API Gateway never directly exposed to internet

### Development Convenience (Direct Access)
```
User → http://localhost:8001/* → API Gateway (direct)
```

- ✅ Direct API Gateway access for curl/Postman/Swagger testing
- ✅ Bypass NGINX for faster development iteration
- ✅ Port exposed only on localhost (not in proxy network)

## Network Configuration

### proxy Network
**Purpose**: Public-facing network for external access

**Services**:
- ✅ NGINX only

**Ports Exposed**:
- 80 (HTTP → redirects to HTTPS)
- 443 (HTTPS)

### backend-network Network
**Purpose**: Internal service communication

**Services**:
- ✅ NGINX (bridge to reach API Gateway)
- ✅ API Gateway
- ✅ Redis
- 🔜 Auth Service
- 🔜 User Service
- 🔜 AI Service

**Ports Exposed** (for development only):
- 8001 (API Gateway - direct access)

## Request Flows

### 1. API Request Through NGINX (Production-like)

```
1. User: curl -k https://localhost/api/v1/users/me
2. NGINX: Receives on port 443
3. NGINX: Rate limits (200 req/min general limit)
4. NGINX: Proxies to http://api-gateway:8001/api/v1/users/me
5. API Gateway: Rate limits (60 req/min per user)
6. API Gateway: Validates JWT token
7. API Gateway: Logs request
8. API Gateway: Routes to User Service
9. User Service: Processes request
10. Response flows back through chain
```

**Headers Added by NGINX**:
- `X-Real-IP`: Client IP address
- `X-Forwarded-For`: Proxy chain
- `X-Forwarded-Proto`: https
- `X-Forwarded-Host`: ft-transcendence.local

**Headers Added by API Gateway**:
- `X-Request-ID`: Unique request identifier
- `X-RateLimit-Limit`: Rate limit maximum
- `X-RateLimit-Remaining`: Requests remaining
- `X-User-ID`: Authenticated user ID (forwarded to backend)
- `X-User-Role`: User role (forwarded to backend)

### 2. Direct API Gateway Access (Development)

```
1. User: curl http://localhost:8001/health
2. API Gateway: Receives directly
3. API Gateway: Processes (no NGINX overhead)
4. Response returned immediately
```

**Use Cases**:
- Testing API Gateway endpoints
- Debugging authentication issues
- Testing rate limiting
- Running integration tests
- Using Swagger/OpenAPI documentation

### 3. Root Path (NGINX Info)

```
1. User: curl -k https://localhost/
2. NGINX: Returns API information JSON
3. No proxy to backend (frontend not implemented yet)
```

## Testing the Setup

### Test 1: Direct API Gateway Access (Development)
```bash
# Health check (public endpoint)
curl http://localhost:8001/health

# Expected: {"status":"healthy","service":"api-gateway","timestamp":"..."}
```

### Test 2: NGINX Proxy to API Gateway (Production-like)
```bash
# Try to access protected endpoint without authentication
curl -k https://localhost/api/v1/users/me

# Expected: {"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required",...}}

# This is CORRECT behavior - API endpoints require authentication!
```

### Test 3: NGINX Root Path
```bash
# Get API information
curl -k https://localhost/

# Expected: {"status":"ok","message":"SmartBreeds API Gateway",...}
```

### Test 4: Verify Network Isolation
```bash
# Check proxy network (should only have NGINX)
docker network inspect ft_transcendence_proxy --format '{{range .Containers}}{{.Name}} {{end}}'
# Expected: ft_transcendence_nginx

# Check backend network (should have NGINX, API Gateway, Redis)
docker network inspect ft_transcendence_backend-network --format '{{range .Containers}}{{.Name}} {{end}}'
# Expected: ft_transcendence_nginx ft_transcendence_redis ft_transcendence_api_gateway
```

## Security Features

### NGINX Layer
- ✅ TLS 1.2/1.3 only
- ✅ Strong cipher suites
- ✅ HSTS headers
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Rate limiting (per-IP)
- ✅ Connection limits
- ✅ Deny hidden files (.env, .git, etc.)

### API Gateway Layer
- ✅ JWT authentication (HTTP-only cookies)
- ✅ Rate limiting per user/IP (Redis-backed)
- ✅ Request correlation (X-Request-ID)
- ✅ Structured logging
- ✅ Standardized error responses

### Network Security
- ✅ API Gateway NOT on public proxy network
- ✅ Backend services isolated on backend-network
- ✅ Only NGINX exposed to internet (ports 80/443)
- ✅ API Gateway exposed on localhost only (development)

## Why This Architecture?

### Production Emulation
This setup matches production best practices:

1. **Single Entry Point**: NGINX is the only public-facing service
2. **Defense in Depth**: Multiple layers of rate limiting and security
3. **Network Isolation**: Backend services on separate network
4. **TLS Termination**: SSL/TLS handled at edge (NGINX)
5. **Centralized Logging**: All traffic logged at NGINX

### Development Convenience
While maintaining production-like architecture:

1. **Direct API Access**: Port 8001 exposed for testing
2. **Fast Iteration**: No need to restart NGINX for API changes
3. **Easy Debugging**: Direct access to API Gateway logs
4. **Tool Support**: Works with Postman, Swagger, curl

## When Frontend is Added

### Update docker-compose.yml
```yaml
frontend:
  networks:
    - proxy  # Frontend on proxy network (served by NGINX)
```

### Update NGINX config
Uncomment the frontend proxy location in `default.conf.template`:
```nginx
location / {
    proxy_pass http://frontend:5173;
    # ... WebSocket support, etc.
}
```

### Request Flow
```
User → NGINX → Frontend (static files + JS)
Frontend (JS) → NGINX → API Gateway → Backend Services
```

The API Gateway port 8001 can remain exposed for direct testing even in production-like setup.

## Production Deployment Changes

For actual production (not emulation):

1. **Remove API Gateway port exposure**:
   ```yaml
   api-gateway:
     # ports:
     #   - "8001:8001"  # Remove this line
   ```

2. **Use production secrets**:
   - Generate secure JWT_SECRET_KEY
   - Use Redis password
   - Use production TLS certificates

3. **Update CORS origins**:
   - Change from localhost to production domain

4. **Enable production logging**:
   - Send logs to centralized system (ELK, CloudWatch, etc.)

5. **Add monitoring**:
   - Prometheus metrics
   - Health check endpoints
   - Alerting rules

## Troubleshooting

### "Connection refused" when accessing through NGINX
- Check NGINX is on backend-network: `docker network inspect ft_transcendence_backend-network`
- Check API Gateway is running: `docker compose ps api-gateway`
- Check NGINX logs: `docker logs ft_transcendence_nginx`

### "502 Bad Gateway" from NGINX
- API Gateway might be down: `docker compose ps api-gateway`
- Check API Gateway health: `curl http://localhost:8001/health`
- Check NGINX can reach API Gateway: `docker exec ft_transcendence_nginx curl -f http://api-gateway:8001/health`

### Rate limiting not working
- Check Redis is running: `docker compose ps redis`
- Test Redis: `docker exec ft_transcendence_redis redis-cli ping`
- Check API Gateway Redis connection in logs

### Authentication always fails
- Check JWT_SECRET_KEY matches between Auth Service and API Gateway
- Verify cookie is being sent: Check browser DevTools → Network → Cookies
- Check API Gateway logs for authentication errors

## Current Status

✅ **Completed**:
- NGINX with TLS, rate limiting, security headers
- API Gateway with JWT auth, rate limiting, logging
- Redis for distributed rate limiting
- Production-like network topology
- Development convenience (port 8001 exposed)

🔜 **Pending**:
- Frontend service
- Auth Service
- User Service
- AI Service

## Summary

This architecture provides:
- ✅ **Production emulation**: Same network topology as production
- ✅ **Security**: Multi-layer protection, network isolation
- ✅ **Observability**: Comprehensive logging at all layers
- ✅ **Development speed**: Direct API access for testing
- ✅ **Scalability**: Ready for microservices addition

All requests in production will flow through NGINX, but developers can also test directly against API Gateway for faster iteration.
