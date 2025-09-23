# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

PlayDay.ai is a visual tool for rapid prototyping of AI experiences, featuring a node-based editor for creating AI workflows that integrate multiple AI providers (OpenAI, Anthropic, Google, ElevenLabs, StableDiffusion).

## Architecture

### Tech Stack
- **Frontend**: Next.js 15 with App Router, React 19, Material-UI (MUI), TailwindCSS
- **Backend**: Node.js task server with WebSocket support
- **Database**: MongoDB
- **Message Queue**: RabbitMQ for task orchestration
- **Authentication**: Auth0 (production) or local auth (development)

### Key Directories
- `app/`: Next.js app router pages and layouts
- `packages/shared/src/`: Shared code between frontend and backend
  - `api/`: API route handlers
  - `backend/`: Server-side business logic (MongoDB, auth, game sessions)
  - `client/components/`: React components including the visual editor
  - `common/`: Shared utilities and constants
- `taskserver/`: Node.js backend server handling AI task execution
- `public/`: Static assets

### Module Aliases
- `@src`: Maps to `packages/shared/src`
- `@components`: Maps to `packages/shared/src/client/components`

## Development Commands

### Windows Development
```bash
# Install dependencies
npm install

# Run frontend (PowerShell)
npm run windev

# Run backend task server (separate terminal, PowerShell)
npm run winserver
```

### Mac/Linux Development
```bash
# Install dependencies
npm install

# Run frontend
npm run dev

# Run backend task server (separate terminal)
npm run taskserver
```

### Build & Production
```bash
# Build for production
npm run build

# Start production server
npm run start

# Docker deployment
./deploy_docker.sh
```

## Key Components

### Visual Editor (`packages/shared/src/client/components/versioneditor/`)
The core visual node editor uses ReactFlow for graph display and manipulation. Nodes represent AI operations, edges represent data flow.

### Game Sessions (`packages/shared/src/backend/gamesessions.js`)
Manages user sessions and state persistence for AI workflows.

### Task Execution (`taskserver/`)
Executes AI tasks via RabbitMQ message queue, supporting parallel execution and various AI providers.

## Database Collections
- `games`: User-created AI workflows/games
- `gameversions`: Version history for each game
- `accounts`: User account information
- `sessions`: Active game sessions and their state

## Environment Configuration
Required `.env` variables:
- `MONGODB_URL`: MongoDB connection string
- `RABBITMQ_URL`: RabbitMQ connection string
- `BASE_URL`: Application base URL
- `protocol`: HTTP or HTTPS
- Auth0 configuration (production only)

## API Pattern
APIs follow a consistent pattern in `packages/shared/src/api/`:
- Each file exports a single API endpoint handler
- Uses `apiRouteAdapter` for Next.js integration
- MongoDB operations via `packages/shared/src/backend/`

## Testing
Currently no automated test suite. Manual testing required for:
- Visual editor functionality
- AI provider integrations
- Session state management
- WebSocket connections