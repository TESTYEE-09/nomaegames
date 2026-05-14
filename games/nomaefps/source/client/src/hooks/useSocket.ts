import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store';
import type { ClientMessage, ServerMessage } from '@shared/types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export function useSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const store = useGameStore();
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback((onOpen?: () => void) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      onOpen?.();
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to server');
      onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        handleMessage(msg);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      reconnectTimeout.current = setTimeout(() => connect(), 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    wsRef.current?.close();
  }, []);

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'joined':
        store.setPlayerId(msg.playerId);
        store.setRoomCode(msg.roomCode);
        store.setPlayers(msg.players);
        store.setInGame(true);
        break;
      case 'state':
        store.setPlayers(msg.players);
        store.setTimeRemaining(msg.timeRemaining);
        const local = msg.players.find(p => p.id === store.playerId);
        if (local) {
          store.setLocalHealth(local.health);
          store.setLocalAmmo(local.weapon.ammo, local.weapon.reserveAmmo, local.weapon.isReloading);
        }
        break;
      case 'playerJoined':
        store.updatePlayer(msg.player);
        break;
      case 'playerLeft':
        store.removePlayer(msg.playerId);
        break;
      case 'hit':
        store.setLocalHealth(msg.health);
        break;
      case 'hitConfirm':
        store.setHitmarkerTime(Date.now());
        break;
      case 'death':
        if (msg.victimId === store.playerId) {
          store.setLocalHealth(0);
        }
        break;
      case 'killFeed':
        store.addKillFeed({
          killer: msg.killer,
          victim: msg.victim,
          time: Date.now()
        });
        break;
      case 'gameStarted':
        store.setGameStarted(true);
        break;
      case 'gameOver':
        store.setGameEnded(true, msg.winnerName);
        break;
      case 'error':
        console.error('Server error:', msg.message);
        break;
    }
  };

  return { connect, disconnect, send };
}
