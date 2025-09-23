# ft_transcendence

A modern web-based multiplayer Pong game with real-time features, tournaments, and social interactions.

## 🚀 Tech Stack

### Frontend
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Socket.IO Client** - Real-time multiplayer communication

### Key Features
- Real-time multiplayer Pong games
- Tournament system with live brackets
- Friend system with presence tracking
- Live notifications and chat
- OAuth 2.0 authentication (Google)

## 📖 Documentation

- **Frontend Architecture**: [docs/frontend/FRONTEND_DOCUMENTATION.md](docs/frontend/FRONTEND_DOCUMENTATION.md)
- **Socket.IO Implementation**: [docs/frontend/socketio-implementation.md](docs/frontend/socketio-implementation.md)
- **API Reference**: [docs/frontend/API-REFERENCE.md](docs/frontend/API-REFERENCE.md)

## 🔧 Development

```bash
# Frontend development
cd srcs/frontend
npm install
npm run dev
```

> **Note**: The frontend uses Socket.IO for real-time features. Ensure your backend implements Socket.IO server for full functionality.