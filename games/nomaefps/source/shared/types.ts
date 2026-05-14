export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface InputState {
  w: boolean;
  a: boolean;
  s: boolean;
  d: boolean;
  space: boolean;
  shift: boolean;
}

export interface WeaponState {
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
}

export interface PlayerState {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  quaternion: { x: number; y: number; z: number; w: number };
  velocity: Vector3;
  health: number;
  score: number;
  isDead: boolean;
  isSprinting: boolean;
  isShooting: boolean;
  weapon: WeaponState;
}

export interface RoomConfig {
  maxPlayers: number;
  maxKills: number;
  maxTime: number;
}

export interface KillFeedEntry {
  killer: string;
  victim: string;
  time: number;
}

export type ClientMessage =
  | { type: 'join'; roomCode: string; name: string }
  | { type: 'input'; inputs: InputState; position: Vector3; rotation: Vector3; quaternion: { x: number; y: number; z: number; w: number }; yaw: number; pitch: number }
  | { type: 'shoot'; origin: Vector3; direction: Vector3 }
  | { type: 'reload' }
  | { type: 'chat'; message: string };

export type ServerMessage =
  | { type: 'joined'; playerId: string; roomCode: string; players: PlayerState[]; config: RoomConfig }
  | { type: 'state'; timeRemaining: number; players: PlayerState[]; killFeed: KillFeedEntry[] }
  | { type: 'playerJoined'; player: PlayerState }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerShoot'; playerId: string; origin: Vector3; direction: Vector3 }
  | { type: 'hit'; damage: number; health: number; direction: Vector3 }
  | { type: 'hitConfirm'; damage: number; isHeadshot: boolean }
  | { type: 'death'; killerId: string; victimId: string; killerName: string; victimName: string }
  | { type: 'playerRespawned'; playerId: string; position: Vector3 }
  | { type: 'killFeed'; killer: string; victim: string; isHeadshot: boolean }
  | { type: 'gameStarted' }
  | { type: 'gameOver'; winnerId: string; winnerName: string }
  | { type: 'chat'; sender: string; message: string }
  | { type: 'error'; message: string };
