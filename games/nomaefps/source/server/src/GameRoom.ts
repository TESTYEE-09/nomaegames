import type WebSocket from 'ws';
import { Player } from './Player.js';
import type { ClientMessage, ServerMessage, PlayerState, Vector3, RoomConfig, KillFeedEntry } from '../../shared/types.js';

const TICK_RATE = 60;
const MAX_PLAYERS = 8;
const GAME_DURATION = 600;
const MAX_KILLS = 15;
const RESPAWN_TIME = 3;
const PLAYER_RADIUS = 0.5;
const MAP_BOUNDS = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };

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
