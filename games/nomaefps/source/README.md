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


## Multiplayer groundwork (implementation-ready)

- **Client transport target:** `ws://localhost:3001` (room code + player name handshake).
- **Client send tick:** 20Hz input packets (`w/a/s/d/space/shift`, yaw/pitch, shoot/reload events).
- **Server sim tick:** 60Hz authoritative movement/combat with state snapshots sent to clients.
- **Reconciliation:** client keeps last acknowledged input id and reapplies unacked inputs after server state.
- **Room flow:** `join -> waiting -> gameStarted -> state updates -> gameOver`.

This lines up with `source/server/src/index.ts` + `GameRoom.ts` so the browser client can be wired incrementally without changing match rules.


## One-map multiplayer mode

- Server now runs a persistent global room (`WORLD`) so every connected player is in the same match space.
- Client `join.roomCode` is ignored by the server in this mode (kept only for protocol compatibility).
- Current player cap is 32 for the shared world session.
