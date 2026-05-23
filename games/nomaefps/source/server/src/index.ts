import { WebSocketServer } from 'ws';
import { GameRoom } from './GameRoom.js';
import type { ClientMessage } from '../../shared/types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const wss = new WebSocketServer({ port: PORT });

const GLOBAL_ROOM_CODE = 'WORLD';
const globalRoom = new GameRoom(GLOBAL_ROOM_CODE, () => {
  // Intentionally no-op: global room is persistent for the one-map mode.
});

wss.on('connection', (ws) => {
  let room: GameRoom | null = null;
  let playerId: string | null = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;

      if (msg.type === 'join') {
        room = globalRoom;
        playerId = room.addPlayer(ws, msg.name);
      } else if (room && playerId) {
        room.handleMessage(playerId, msg);
      }
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    if (room && playerId) {
      room.removePlayer(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

console.log(`Arena FPS one-map server running on port ${PORT} (room: ${GLOBAL_ROOM_CODE})`);
