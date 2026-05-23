import type WebSocket from 'ws';
import { Player } from './Player.js';
import type { ClientMessage, ServerMessage, PlayerState, Vector3, RoomConfig, KillFeedEntry } from '../../shared/types.js';

const TICK_RATE = 60;
const MAX_PLAYERS = 32;
const GAME_DURATION = 600;
const MAX_KILLS = 15;
const RESPAWN_TIME = 3;
const PLAYER_RADIUS = 0.5;
const MAP_BOUNDS = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };


type Obstacle = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

const MAP_OBSTACLES: Obstacle[] = [
  { minX: -10, maxX: 10, minY: 0, maxY: 2.1, minZ: -10, maxZ: 10 },
  { minX: -16.5, maxX: -13.5, minY: 0, maxY: 3, minZ: -16.5, maxZ: -13.5 },
  { minX: 13.5, maxX: 16.5, minY: 0, maxY: 3, minZ: -16.5, maxZ: -13.5 },
  { minX: -16.5, maxX: -13.5, minY: 0, maxY: 3, minZ: 13.5, maxZ: 16.5 },
  { minX: 13.5, maxX: 16.5, minY: 0, maxY: 3, minZ: 13.5, maxZ: 16.5 },
  { minX: -9, maxX: -7, minY: 0, maxY: 2, minZ: -9, maxZ: -7 },
  { minX: 7, maxX: 9, minY: 0, maxY: 2, minZ: -9, maxZ: -7 },
  { minX: -9, maxX: -7, minY: 0, maxY: 2, minZ: 7, maxZ: 9 },
  { minX: 7, maxX: 9, minY: 0, maxY: 2, minZ: 7, maxZ: 9 },
  { minX: -25.25, maxX: -24.75, minY: 0, maxY: 1.5, minZ: -4, maxZ: 4 },
  { minX: 24.75, maxX: 25.25, minY: 0, maxY: 1.5, minZ: -4, maxZ: 4 },
  { minX: -4, maxX: 4, minY: 0, maxY: 1.5, minZ: -25.25, maxZ: -24.75 },
  { minX: -4, maxX: 4, minY: 0, maxY: 1.5, minZ: 24.75, maxZ: 25.25 }
];

export class GameRoom {
  code: string;
  players = new Map<string, Player>();
  gameStarted = false;
  gameEnded = false;
  timeRemaining = GAME_DURATION;
  winnerId: string | null = null;
  private loopInterval: NodeJS.Timeout | null = null;
  private onEmpty: (room: GameRoom) => void;
  private killFeed: KillFeedEntry[] = [];

  constructor(code: string, onEmpty: (room: GameRoom) => void) {
    this.code = code;
    this.onEmpty = onEmpty;
    this.startLoop();
  }

  addPlayer(ws: WebSocket, name: string): string {
    if (this.players.size >= MAX_PLAYERS) {
      ws.send(JSON.stringify({ type: 'error', message: 'Room full' }));
      return '';
    }

    const id = crypto.randomUUID();
    const spawnPoint = this.getSpawnPoint();
    const player = new Player(id, name, ws, spawnPoint);
    this.players.set(id, player);

    this.sendTo(id, {
      type: 'joined',
      playerId: id,
      roomCode: this.code,
      players: this.getPlayerStates(),
      config: this.getConfig()
    });

    this.broadcast({
      type: 'playerJoined',
      player: player.getState()
    }, id);

    if (this.players.size >= 2 && !this.gameStarted) {
      this.startGame();
    }

    return id;
  }

  removePlayer(id: string) {
    const player = this.players.get(id);
    if (!player) return;

    this.players.delete(id);
    this.broadcast({ type: 'playerLeft', playerId: id });

    if (this.players.size === 0) {
      this.stopLoop();
      this.onEmpty(this);
    }
  }

  handleMessage(playerId: string, msg: ClientMessage) {
    const player = this.players.get(playerId);
    if (!player || player.isDead) return;

    switch (msg.type) {
      case 'input':
        player.updateInput(msg);
        break;
      case 'shoot':
        this.handleShoot(playerId, msg);
        break;
      case 'reload':
        player.reload();
        break;
      case 'chat':
        this.broadcast({
          type: 'chat',
          sender: player.name,
          message: msg.message
        });
        break;
    }
  }

  private handleShoot(shooterId: string, msg: Extract<ClientMessage, { type: 'shoot' }>) {
    const shooter = this.players.get(shooterId);
    if (!shooter || shooter.isDead || shooter.isReloading) return;
    if (!shooter.useAmmo()) return;

    const origin = msg.origin;
    const dir = msg.direction;

    const len = Math.sqrt(dir.x*dir.x + dir.y*dir.y + dir.z*dir.z);
    if (len === 0) return;
    const ndir = { x: dir.x/len, y: dir.y/len, z: dir.z/len };

    let closestHit: { player: Player; dist: number; isHeadshot: boolean } | null = null;
    const headY = 1.6;
    const bodyY = 0.9;

    for (const [id, target] of this.players) {
      if (id === shooterId || target.isDead) continue;

      const toTarget = {
        x: target.position.x - origin.x,
        y: target.position.y - origin.y,
        z: target.position.z - origin.z
      };

      const dot = toTarget.x*ndir.x + toTarget.y*ndir.y + toTarget.z*ndir.z;
      if (dot <= 0) continue;

      const closest = {
        x: origin.x + ndir.x * dot,
        y: origin.y + ndir.y * dot,
        z: origin.z + ndir.z * dot
      };

      const dx = closest.x - target.position.x;
      const dz = closest.z - target.position.z;
      const horizontalDist = Math.sqrt(dx*dx + dz*dz);

      if (horizontalDist > PLAYER_RADIUS) continue;

      if (this.isLineOfSightBlocked(origin, target.position)) continue;

      const dy = closest.y - target.position.y;
      const isHeadshot = Math.abs(dy - headY) < 0.25;
      const isBody = Math.abs(dy - bodyY) < 0.6;

      if (!isHeadshot && !isBody) continue;

      const dist = Math.sqrt(
        (closest.x - origin.x)**2 + 
        (closest.y - origin.y)**2 + 
        (closest.z - origin.z)**2
      );

      if (!closestHit || dist < closestHit.dist) {
        closestHit = { player: target, dist, isHeadshot };
      }
    }

    if (closestHit) {
      const damage = closestHit.isHeadshot ? 50 : 25;
      closestHit.player.takeDamage(damage);

      this.sendTo(closestHit.player.id, {
        type: 'hit',
        damage,
        health: closestHit.player.health,
        direction: this.getHitDirection(closestHit.player.position, origin)
      });

      this.sendTo(shooterId, {
        type: 'hitConfirm',
        damage,
        isHeadshot: closestHit.isHeadshot
      });

      if (closestHit.player.isDead) {
        shooter.score++;
        this.killFeed.push({
          killer: shooter.name,
          victim: closestHit.player.name,
          time: Date.now()
        });

        this.broadcast({
          type: 'killFeed',
          killer: shooter.name,
          victim: closestHit.player.name,
          isHeadshot: closestHit.isHeadshot
        });

        this.broadcast({
          type: 'death',
          killerId: shooterId,
          victimId: closestHit.player.id,
          killerName: shooter.name,
          victimName: closestHit.player.name
        });

        if (shooter.score >= MAX_KILLS) {
          this.endGame(shooterId);
        }

        setTimeout(() => {
          if (this.players.has(closestHit.player.id)) {
            closestHit.player.respawn(this.getSpawnPoint());
            this.broadcast({
              type: 'playerRespawned',
              playerId: closestHit.player.id,
              position: closestHit.player.position
            });
          }
        }, RESPAWN_TIME * 1000);
      }
    }

    this.broadcast({
      type: 'playerShoot',
      playerId: shooterId,
      origin,
      direction: ndir
    }, shooterId);
  }



  private isLineOfSightBlocked(origin: Vector3, target: Vector3): boolean {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = target.z - origin.z;

    for (const obstacle of MAP_OBSTACLES) {
      let tMin = 0;
      let tMax = 1;

      const intersectsAxis = (start: number, delta: number, min: number, max: number) => {
        if (Math.abs(delta) < 0.000001) {
          return start >= min && start <= max;
        }

        const inv = 1 / delta;
        let t1 = (min - start) * inv;
        let t2 = (max - start) * inv;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        return tMin <= tMax;
      };

      if (!intersectsAxis(origin.x, dx, obstacle.minX, obstacle.maxX)) continue;
      if (!intersectsAxis(origin.y, dy, obstacle.minY, obstacle.maxY)) continue;
      if (!intersectsAxis(origin.z, dz, obstacle.minZ, obstacle.maxZ)) continue;

      if (tMax >= 0 && tMin <= 1) {
        return true;
      }
    }

    return false;
  }
  private getHitDirection(targetPos: Vector3, origin: Vector3): Vector3 {
    return {
      x: origin.x - targetPos.x,
      y: 0,
      z: origin.z - targetPos.z
    };
  }

  private startGame() {
    this.gameStarted = true;
    this.timeRemaining = GAME_DURATION;
    this.broadcast({ type: 'gameStarted' });
  }

  private endGame(winnerId: string) {
    this.gameEnded = true;
    this.winnerId = winnerId;
    const winner = this.players.get(winnerId);
    this.broadcast({
      type: 'gameOver',
      winnerId,
      winnerName: winner?.name || ''
    });
  }

  private startLoop() {
    this.loopInterval = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  private stopLoop() {
    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }
  }

  private tick() {
    if (this.gameStarted && !this.gameEnded) {
      this.timeRemaining -= 1 / TICK_RATE;
      if (this.timeRemaining <= 0) {
        let bestId = '';
        let bestScore = -1;
        for (const [id, p] of this.players) {
          if (p.score > bestScore) {
            bestScore = p.score;
            bestId = id;
          }
        }
        this.endGame(bestId);
      }
    }

    for (const player of this.players.values()) {
      player.tick(1 / TICK_RATE);
      this.clampPosition(player);
    }

    const state: ServerMessage = {
      type: 'state',
      timeRemaining: Math.ceil(this.timeRemaining),
      players: this.getPlayerStates(),
      killFeed: this.killFeed.slice(-5)
    };
    this.broadcast(state);
  }

  private clampPosition(player: Player) {
    player.position.x = Math.max(MAP_BOUNDS.minX, Math.min(MAP_BOUNDS.maxX, player.position.x));
    player.position.z = Math.max(MAP_BOUNDS.minZ, Math.min(MAP_BOUNDS.maxZ, player.position.z));
    player.position.y = Math.max(0, player.position.y);
  }

  private getSpawnPoint(): Vector3 {
    const spawns = [
      { x: -40, y: 2, z: -40 },
      { x: 40, y: 2, z: 40 },
      { x: -40, y: 2, z: 40 },
      { x: 40, y: 2, z: -40 },
      { x: 0, y: 2, z: -40 },
      { x: 0, y: 2, z: 40 },
      { x: -40, y: 2, z: 0 },
      { x: 40, y: 2, z: 0 }
    ];
    return spawns[this.players.size % spawns.length];
  }

  private getPlayerStates(): PlayerState[] {
    return Array.from(this.players.values()).map(p => p.getState());
  }

  private getConfig(): RoomConfig {
    return {
      maxPlayers: MAX_PLAYERS,
      maxKills: MAX_KILLS,
      maxTime: GAME_DURATION
    };
  }

  private broadcast(msg: ServerMessage, excludeId?: string) {
    const data = JSON.stringify(msg);
    for (const [id, player] of this.players) {
      if (id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  private sendTo(playerId: string, msg: ServerMessage) {
    const player = this.players.get(playerId);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(msg));
    }
  }
}
