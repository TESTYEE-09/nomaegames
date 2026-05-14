import { WebSocketServer } from 'ws';
import { GameRoom } from './GameRoom.js';
import type { ClientMessage } from '../../shared/types.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map<string, GameRoom>();

function getOrCreateRoom(code: string): GameRoom {
  if (!rooms.has(code)) {
    rooms.set(code, new GameRoom(code, (room) => {
      rooms.delete(room.code);
    }));
  }
  return rooms.get(code)!;
}

wss.on('connection', (ws) => {
  let room: GameRoom | null = null;
  let playerId: string | null = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString()) as ClientMessage;

      if (msg.type === 'join') {
        room = getOrCreateRoom(msg.roomCode);
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

console.log(`Arena FPS server running on port ${PORT}`);
