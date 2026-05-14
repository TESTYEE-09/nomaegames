import { create } from 'zustand';
import type { PlayerState, KillFeedEntry } from '@shared/types';

interface GameState {
  inGame: boolean;
  showSettings: boolean;
  showScoreboard: boolean;
  playerId: string | null;
  roomCode: string | null;
  players: PlayerState[];
  killFeed: KillFeedEntry[];
  timeRemaining: number;
  gameStarted: boolean;
  gameEnded: boolean;
  winnerName: string | null;
  localHealth: number;
  localAmmo: number;
  localReserve: number;
  localIsReloading: boolean;
  hitmarkerTime: number;
  sensitivity: number;
  volume: number;
  graphicsQuality: 'low' | 'medium' | 'high';
  isPointerLocked: boolean;

  setInGame: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowScoreboard: (v: boolean) => void;
  setPlayerId: (id: string) => void;
  setRoomCode: (code: string) => void;
  setPlayers: (players: PlayerState[]) => void;
  updatePlayer: (player: PlayerState) => void;
  removePlayer: (id: string) => void;
  addKillFeed: (entry: KillFeedEntry) => void;
  setTimeRemaining: (t: number) => void;
  setGameStarted: (v: boolean) => void;
  setGameEnded: (v: boolean, winner?: string) => void;
  setLocalHealth: (h: number) => void;
  setLocalAmmo: (a: number, r: number, reloading: boolean) => void;
  setHitmarkerTime: (t: number) => void;
  setSensitivity: (s: number) => void;
  setVolume: (v: number) => void;
  setGraphicsQuality: (q: 'low' | 'medium' | 'high') => void;
  setPointerLocked: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  inGame: false,
  showSettings: false,
  showScoreboard: false,
  playerId: null,
  roomCode: null,
  players: [],
  killFeed: [],
  timeRemaining: 0,
  gameStarted: false,
  gameEnded: false,
  winnerName: null,
  localHealth: 100,
  localAmmo: 30,
  localReserve: 90,
  localIsReloading: false,
  hitmarkerTime: 0,
  sensitivity: 1.0,
  volume: 0.5,
  graphicsQuality: 'medium' as const,
  isPointerLocked: false
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,

  setInGame: (v) => set({ inGame: v }),
  setShowSettings: (v) => set({ showSettings: v }),
  setShowScoreboard: (v) => set({ showScoreboard: v }),
  setPlayerId: (id) => set({ playerId: id }),
  setRoomCode: (code) => set({ roomCode: code }),
  setPlayers: (players) => set({ players }),
  updatePlayer: (player) => set((state) => ({
    players: state.players.map(p => p.id === player.id ? player : p)
  })),
  removePlayer: (id) => set((state) => ({
    players: state.players.filter(p => p.id !== id)
  })),
  addKillFeed: (entry) => set((state) => ({
    killFeed: [...state.killFeed.slice(-4), entry]
  })),
  setTimeRemaining: (t) => set({ timeRemaining: t }),
  setGameStarted: (v) => set({ gameStarted: v }),
  setGameEnded: (v, winner) => set({ gameEnded: v, winnerName: winner || null }),
  setLocalHealth: (h) => set({ localHealth: h }),
  setLocalAmmo: (a, r, reloading) => set({ localAmmo: a, localReserve: r, localIsReloading: reloading }),
  setHitmarkerTime: (t) => set({ hitmarkerTime: t }),
  setSensitivity: (s) => set({ sensitivity: s }),
  setVolume: (v) => set({ volume: v }),
  setGraphicsQuality: (q) => set({ graphicsQuality: q }),
  setPointerLocked: (v) => set({ isPointerLocked: v }),
  reset: () => set(initialState)
}));
