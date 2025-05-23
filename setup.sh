#!/bin/bash

# ft_transcendence Project Setup Script

set -e

echo "🚀 Setting up ft_transcendence project structure..."

# Create directory structure
directories=(
    "backend"
    "frontend"
    "docker/nginx/conf.d"
    "docker/nginx/ssl"
    "docker/backend"
    "docker/frontend"
    "docker/database"
    "docs"
    "backups"
    "logs"
)

for dir in "${directories[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "✅ Created directory: $dir"
    fi
done

# Copy .env.example to .env if it doesn't exist
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo "⚠️  Please update .env with your actual values!"
    fi
fi

# Create basic backend structure (PHP initially)
if [ ! -f "backend/index.php" ]; then
    cat > backend/index.php << 'EOF'
<?php
/**
 * ft_transcendence Backend Entry Point
 * 
 * @brief Main entry point for the PHP backend
 * This will be replaced with Node.js/Fastify when implementing the Web module
 */

// Enable error reporting for development
ini_set('display_errors', 0);
error_reporting(E_ALL);

// CORS headers for API
header('Access-Control-Allow-Origin: https://localhost');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Basic routing
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

switch ($path) {
    case '/api/health':
        echo json_encode(['status' => 'healthy', 'timestamp' => time()]);
        break;
    
    case '/api/info':
        echo json_encode([
            'app' => 'ft_transcendence',
            'version' => '1.0.0',
            'backend' => 'PHP',
            'message' => 'Ready to implement game logic!'
        ]);
        break;
    
    default:
        http_response_code(404);
        echo json_encode(['error' => 'Not Found']);
        break;
}
EOF
    echo "✅ Created backend/index.php"
fi

# Create basic frontend structure
if [ ! -f "frontend/index.html" ]; then
    cat > frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ft_transcendence - Pong Game</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="app">
        <h1>ft_transcendence</h1>
        <p>Pong Game - Ready for Implementation</p>
        <div id="game-container">
            <!-- Pong game will be rendered here -->
        </div>
    </div>
    <script type="module" src="main.ts"></script>
</body>
</html>
EOF
    echo "✅ Created frontend/index.html"
fi

if [ ! -f "frontend/main.ts" ]; then
    cat > frontend/main.ts << 'EOF'
/**
 * @brief Main TypeScript entry point for ft_transcendence frontend
 * 
 * @description Initializes the Single Page Application and game logic
 */

console.log('ft_transcendence - Frontend initialized');

// Check backend health
fetch('/api/health')
    .then(response => response.json())
    .then(data => {
        console.log('Backend health:', data);
    })
    .catch(error => {
        console.error('Backend connection error:', error);
    });

// Initialize SPA router
window.addEventListener('popstate', handleRoute);
document.addEventListener('DOMContentLoaded', handleRoute);

/**
 * @brief Handle SPA routing
 */
function handleRoute(): void {
    const path = window.location.pathname;
    console.log('Current route:', path);
    
    // Route handling will be implemented here
}
EOF
    echo "✅ Created frontend/main.ts"
fi

if [ ! -f "frontend/package.json" ]; then
    cat > frontend/package.json << 'EOF'
{
  "name": "ft-transcendence-frontend",
  "version": "1.0.0",
  "description": "ft_transcendence Frontend",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {}
}
EOF
    echo "✅ Created frontend/package.json"
fi

if [ ! -f "frontend/tsconfig.json" ]; then
    cat > frontend/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
EOF
    echo "✅ Created frontend/tsconfig.json"
fi

if [ ! -f "frontend/vite.config.ts" ]; then
    cat > frontend/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
EOF
    echo "✅ Created frontend/vite.config.ts"
fi

# Create backend package.json for future Node.js migration
if [ ! -f "backend/package.json" ]; then
    cat > backend/package.json << 'EOF'
{
  "name": "ft-transcendence-backend",
  "version": "1.0.0",
  "description": "ft_transcendence Backend (will migrate to Fastify)",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "fastify": "^4.25.0",
    "sqlite3": "^5.1.6",
    "@fastify/cors": "^8.5.0",
    "@fastify/websocket": "^8.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "nodemon": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
EOF
    echo "✅ Created backend/package.json"
fi

# Make scripts executable
chmod +x docker/database/init-db.sh

# Create README for Docker setup
cat > docs/DOCKER_SETUP.md << 'EOF'
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
EOF

echo ""
echo "✅ ft_transcendence Docker environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy .env.example to .env and update values"
echo "2. Run 'make' to start the application"
echo "3. Access https://localhost in your browser"
echo ""
echo "📚 Check docs/DOCKER_SETUP.md for more information"