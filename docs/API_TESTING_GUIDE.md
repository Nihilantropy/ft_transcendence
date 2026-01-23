# API Testing Guide - Development Setup

## Quick Reference

### Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **NGINX (Production-like)** | `https://localhost/api/*` | Route through NGINX (full stack) |
| **API Gateway (Direct)** | `http://localhost:8001/*` | Direct testing (development) |
| **NGINX Info** | `https://localhost/` | API information page |

## Access Methods

### Method 1: Through NGINX (Recommended for Integration Testing)

**Use when**: Testing the full production-like stack

```bash
# Health check (requires auth through NGINX)
curl -k https://localhost/api/health

# Login (public endpoint)
curl -k -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Protected endpoint (requires JWT cookie)
curl -k https://localhost/api/v1/users/me \
  --cookie "access_token=YOUR_JWT_TOKEN"
```

**Benefits**:
- ✅ Tests NGINX rate limiting
- ✅ Tests TLS termination
- ✅ Tests security headers
- ✅ Emulates production environment
- ✅ Tests full request pipeline

### Method 2: Direct API Gateway (Recommended for Development)

**Use when**: Developing/debugging API Gateway features

```bash
# Health check (public)
curl http://localhost:8001/health

# Login (public endpoint)
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Protected endpoint (requires JWT cookie)
curl http://localhost:8001/api/v1/users/me \
  --cookie "access_token=YOUR_JWT_TOKEN"
```

**Benefits**:
- ✅ Faster (no NGINX overhead)
- ✅ Easier debugging
- ✅ Direct access to API Gateway logs
- ✅ Better for development iteration

## Using Postman/Insomnia

### Setup 1: Through NGINX (Production-like)

1. **Base URL**: `https://localhost`
2. **Disable SSL verification** (self-signed cert)
3. **Cookie management**: Enable automatic cookie handling
4. **Headers**: Will be added by NGINX automatically

### Setup 2: Direct API Gateway (Development)

1. **Base URL**: `http://localhost:8001`
2. **Cookie management**: Enable automatic cookie handling
3. **No SSL** required

## Authentication Flow

### 1. Login Request

```bash
# Through NGINX
curl -k -X POST https://localhost/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' \
  -c cookies.txt  # Save cookies to file

# Direct
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' \
  -c cookies.txt
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "role": "user"
    }
  }
}
```

**Cookie Set**: `access_token=eyJhbGc... (HTTP-only cookie)`

### 2. Authenticated Request

```bash
# Through NGINX
curl -k https://localhost/api/v1/users/me \
  -b cookies.txt  # Load cookies from file

# Direct
curl http://localhost:8001/api/v1/users/me \
  -b cookies.txt
```

## Rate Limiting Testing

### NGINX Rate Limiting (200 req/min)

```bash
# Test NGINX rate limit
for i in {1..300}; do
  curl -k -s -o /dev/null -w "%{http_code}\n" https://localhost/api/health
  sleep 0.1
done

# After ~200 requests, you'll see: 429
```

### API Gateway Rate Limiting (60 req/min per user)

```bash
# Test API Gateway rate limit (direct)
for i in {1..100}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/health
  sleep 0.1
done

# After ~60 requests, you'll see: 429
```

**Rate Limit Headers**:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
Retry-After: 30
```

## Testing Different Scenarios

### Scenario 1: Unauthenticated Access to Protected Endpoint

```bash
# Should return 401
curl -k https://localhost/api/v1/users/me

# Response:
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

### Scenario 2: Expired Token

```bash
# Wait for token to expire (1 hour default)
# Or use a manually created expired token

curl -k https://localhost/api/v1/users/me \
  --cookie "access_token=EXPIRED_TOKEN"

# Response:
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Token has expired"
  }
}
```

### Scenario 3: Invalid Token

```bash
curl -k https://localhost/api/v1/users/me \
  --cookie "access_token=invalid.token.here"

# Response:
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid token"
  }
}
```

### Scenario 4: Public Endpoint (No Auth Required)

```bash
# These work without authentication:
curl -k https://localhost/api/v1/auth/login
curl -k https://localhost/api/v1/auth/register
curl -k https://localhost/api/v1/auth/refresh

# Direct:
curl http://localhost:8001/api/v1/auth/login
```

## Debugging

### Check Service Status

```bash
# All services
docker compose ps

# Specific service
docker compose ps api-gateway
```

### View Logs

```bash
# API Gateway logs
docker logs -f ft_transcendence_api_gateway

# NGINX logs
docker logs -f ft_transcendence_nginx

# NGINX access logs
docker exec ft_transcendence_nginx tail -f /var/log/nginx/api_access.log

# Redis logs
docker logs -f ft_transcendence_redis
```

### Test Network Connectivity

```bash
# Test NGINX can reach API Gateway
docker exec ft_transcendence_nginx curl -f http://api-gateway:8001/health

# Test API Gateway can reach Redis
docker exec ft_transcendence_api_gateway python -c "import redis; r = redis.from_url('redis://redis:6379/0'); print(r.ping())"
```

### Verify Network Topology

```bash
# Check proxy network (should only have NGINX)
docker network inspect ft_transcendence_proxy --format '{{range .Containers}}{{.Name}} {{end}}'

# Check backend network (should have NGINX, API Gateway, Redis)
docker network inspect ft_transcendence_backend-network --format '{{range .Containers}}{{.Name}} {{end}}'
```

## Common Issues

### Issue 1: "Connection refused" on localhost:8001

**Cause**: API Gateway not running or port not exposed

**Solution**:
```bash
docker compose ps api-gateway
docker compose up api-gateway -d
```

### Issue 2: "502 Bad Gateway" from NGINX

**Cause**: NGINX can't reach API Gateway

**Solution**:
```bash
# Check if API Gateway is healthy
curl http://localhost:8001/health

# Check NGINX can reach it
docker exec ft_transcendence_nginx curl -f http://api-gateway:8001/health

# Check networks
docker compose ps
docker network inspect ft_transcendence_backend-network
```

### Issue 3: Authentication always fails

**Cause**: JWT_SECRET_KEY mismatch or cookie not sent

**Solutions**:
```bash
# 1. Verify cookie is being set
curl -v http://localhost:8001/api/v1/auth/login \
  -d '{"email":"user@example.com","password":"pass"}' \
  -H "Content-Type: application/json" \
  2>&1 | grep -i "set-cookie"

# 2. Check JWT_SECRET_KEY in .env files match
docker exec ft_transcendence_api_gateway env | grep JWT_SECRET_KEY

# 3. Check API Gateway logs for auth errors
docker logs ft_transcendence_api_gateway | grep -i auth
```

### Issue 4: Rate limiting not working

**Cause**: Redis not connected

**Solutions**:
```bash
# Check Redis is running
docker compose ps redis

# Test Redis connection
docker exec ft_transcendence_redis redis-cli ping

# Check API Gateway can reach Redis
docker exec ft_transcendence_api_gateway env | grep REDIS_URL
```

## Swagger/OpenAPI Documentation

Once the Auth Service provides a Swagger endpoint, you can access it at:

```
# Through NGINX
https://localhost/api/docs

# Direct
http://localhost:8001/docs
```

## Best Practices

### Development Workflow

1. **Use direct access** (localhost:8001) for:
   - Rapid testing during development
   - Debugging authentication issues
   - Testing API Gateway features
   - Running integration tests

2. **Use NGINX proxy** (localhost/api) for:
   - Testing full production stack
   - Verifying NGINX configuration
   - Testing rate limiting at both layers
   - Pre-deployment validation

### Testing Strategy

1. **Unit tests**: Test individual components in isolation
2. **Integration tests**: Use direct API Gateway access
3. **E2E tests**: Use NGINX proxy (full stack)
4. **Load tests**: Test through NGINX to validate rate limiting

### Security Testing

```bash
# Test CORS
curl -k https://localhost/api/health \
  -H "Origin: https://malicious-site.com" \
  -v

# Test rate limiting
# (See Rate Limiting Testing section above)

# Test authentication bypass attempts
curl -k https://localhost/api/v1/users/me \
  -H "X-User-ID: fake-user-id"  # Should not work

# Test SQL injection (if using databases)
curl -k https://localhost/api/v1/users/search \
  -d '{"query":"'; DROP TABLE users;--"}'
```

## Summary

| Feature | Through NGINX | Direct API Gateway |
|---------|---------------|-------------------|
| **URL** | `https://localhost/api/*` | `http://localhost:8001/*` |
| **TLS** | ✅ Yes | ❌ No |
| **NGINX Rate Limit** | ✅ Yes (200/min) | ❌ No |
| **API Gateway Rate Limit** | ✅ Yes (60/min) | ✅ Yes (60/min) |
| **Security Headers** | ✅ Yes | ❌ No |
| **Logging** | ✅ NGINX + API Gateway | ✅ API Gateway only |
| **Speed** | Slower (2 hops) | Faster (direct) |
| **Use Case** | Integration testing | Development |

Choose the right access method based on what you're testing!
