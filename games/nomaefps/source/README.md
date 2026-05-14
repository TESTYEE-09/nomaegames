# Arena FPS

Fast, colourful, polished browser-based 3D multiplayer FPS.

## Quick Start

```bash
npm run install:all
npm run dev
```

- Client: http://localhost:5173
- Server: ws://localhost:3001

## Controls
- **WASD** — Move
- **Mouse** — Look (click canvas to lock)
- **Space** — Jump
- **Shift** — Sprint
- **Mouse1** — Shoot
- **R** — Reload
- **Tab** — Scoreboard
- **Esc** — Menu / Unlock mouse

## Deploy
1. `cd client && npm run build`
2. Serve `client/dist` as static files
3. `cd server && npm start` (or use PM2)
