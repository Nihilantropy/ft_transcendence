# Nginx Configuration for ft_transcendence

## Overview

This nginx setup provides HTTPS access to ft_transcendence using a custom domain configured via environment variables. The domain follows the pattern: `https://${HOST_DOMAIN}:4433`.

**Ports**:
- HTTP: `8000` (redirects to HTTPS)
- HTTPS: `4433`

## Environment Variables

Configure the following variables in `.env`:

```bash
HOST_DOMAIN="ft-transcendence.local"  # Base domain
```

**Result**: Application accessible at `https://ft-transcendence.local:4433`

## Features

### SSL/TLS Support
- Self-signed certificates generated automatically at container startup
- Certificates include proper Common Name (CN) and Subject Alternative Name (SAN)
- TLS 1.2 and 1.3 support

### Proxied Services
1. **Backend API** (`/api`) - Proxies to `backend:8000`
2. **Socket.IO WebSockets** (`/socket.io/`) - Real-time communication
3. **Vite HMR WebSocket** (`/vite-hmr`) - Hot Module Replacement for development
4. **Vite Assets** (`/node_modules`, `/@vite`, `/@fs`, `/src`) - Development asset serving
5. **Frontend** (`/`) - Main application served from `frontend:5173`

### CORS Configuration
All CORS headers are dynamically configured to match your domain:
- `Access-Control-Allow-Origin: https://${HOST_DOMAIN}`

### WebSocket Support
- Proper upgrade headers for WebSocket connections
- Long-lived connection timeouts (24h for Socket.IO)
- Shorter timeouts for HMR (60s)
- Buffering disabled for real-time communication

## Files

```
srcs/nginx/
Dockerfile                    # Container build configuration
docker-entrypoint.sh          # Startup script (env substitution + SSL generation)
nginx.conf                    # Main nginx configuration
conf.d/
default.conf.template         # Server config template with env variables
error_pages/                  # Custom error pages
ssl/                          # SSL certificates (generated at runtime)
.env                          # Environment variables
```

## How It Works

1. **Container Build**: Dockerfile copies configuration template and entrypoint script
2. **Container Startup**:
   - `docker-entrypoint.sh` runs
   - Substitutes `${HOST_DOMAIN}` in `default.conf.template`
   - Generates output to `/etc/nginx/conf.d/default.conf`
   - Creates SSL certificate with correct domain name
   - Starts nginx
3. **Runtime**: Nginx serves requests with proper domain configuration

## Local Development Setup

### 1. Update `/etc/hosts`

Add your domain to your hosts file:

```bash
sudo nano /etc/hosts
```

Add this line:
```
127.0.0.1    ft-transcendence.local
```

### 2. Configure Environment

Edit `srcs/nginx/.env`:
```bash
HOST_DOMAIN="ft-transcendence.local"
```

### 3. Build and Run

```bash
docker-compose up --build nginx
```

### 4. Access Application

Open your browser to: `https://ft-transcendence.local:4433`

(Accept the self-signed certificate warning)

**Note**: HTTP requests to `http://ft-transcendence.local:8000` will automatically redirect to HTTPS on port 4433.

## Security Notes

**Development Only**: This configuration uses:
- Self-signed SSL certificates
- Permissive CORS headers
- `'unsafe-inline'` and `'unsafe-eval'` in CSP

**Production**: Replace with:
- Valid SSL certificates (Let's Encrypt, etc.)
- Strict CORS policies
- Stricter Content Security Policy
- Remove Vite HMR endpoints

## Troubleshooting

### Certificate Errors
- Check that SSL files are generated: `docker exec ft_transcendence_nginx ls -la /etc/nginx/ssl/`
- Verify domain in certificate: `docker exec ft_transcendence_nginx openssl x509 -in /etc/nginx/ssl/selfsigned.crt -text -noout | grep CN`

### Domain Not Resolving
- Verify `/etc/hosts` entry
- Check `docker logs ft_transcendence_nginx` for startup messages

### CORS Issues
- Check that CORS origin matches your domain
- Inspect browser console for specific CORS errors
- Verify environment variables: `docker exec ft_transcendence_nginx env | grep DOMAIN`

### WebSocket Connection Failures
- Check browser developer tools Network tab (filter by WS)
- Verify upgrade headers in nginx logs: `/var/log/nginx/ws_access.log`
- Ensure CSP allows `ws:` and `wss:` connections

## Configuration Details

### Timeouts
- API requests: 30s
- Socket.IO connections: 24h
- HMR connections: 60s
- Frontend requests: 30s

### Logging
Separate log files for debugging:
- `/var/log/nginx/https_access.log` - HTTPS requests
- `/var/log/nginx/http_access.log` - HTTP requests (redirects)
- `/var/log/nginx/api_access.log` - Backend API calls
- `/var/log/nginx/ws_access.log` - WebSocket connections
- `/var/log/nginx/hmr_access.log` - Vite HMR
- `/var/log/nginx/proxy_access.log` - Frontend proxy
- `/var/log/nginx/https_error.log` - Error log

View logs:
```bash
docker exec ft_transcendence_nginx tail -f /var/log/nginx/https_access.log
```

## Architecture

```
Browser (https://ft-transcendence.local)
    �
Nginx Container (4433/tcp)
/api              � backend:8000
/socket.io/       � backend:8000 (WebSocket)
/vite-hmr         � frontend:5173 (WebSocket)
/node_modules/... � frontend:5173
/                 � frontend:5173
```
