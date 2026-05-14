import type WebSocket from 'ws';
import type { PlayerState, Vector3, ClientMessage } from '../../shared/types.js';

const MOVE_SPEED = 10;
const SPRINT_SPEED = 16;
const JUMP_FORCE = 8;
const GRAVITY = 25;
const FRICTION = 8;
const AIR_CONTROL = 0.3;
const MAX_HEALTH = 100;
const MAG_SIZE = 30;
const RESERVE_AMMO = 90;
const RELOAD_TIME = 2.0;

export class Player {
  id: string;
  name: string;
  ws: WebSocket;
  position: Vector3;
  velocity: Vector3 = { x: 0, y: 0, z: 0 };
  rotation: Vector3 = { x: 0, y: 0, z: 0 };
  quaternion = { x: 0, y: 0, z: 0, w: 1 };
  health = MAX_HEALTH;
  score = 0;
  isDead = false;
  isSprinting = false;
  isReloading = false;
  isGrounded = false;
  ammo = MAG_SIZE;
  reserveAmmo = RESERVE_AMMO;
  reloadTimer = 0;

  private inputs = { w: false, a: false, s: false, d: false, space: false, shift: false };
  private yaw = 0;
  private pitch = 0;

  constructor(id: string, name: string, ws: WebSocket, spawn: Vector3) {
    this.id = id;
    this.name = name;
    this.ws = ws;
    this.position = { ...spawn };
  }

  updateInput(msg: Extract<ClientMessage, { type: 'input' }>) {
    if (msg.inputs) this.inputs = msg.inputs;
    if (msg.rotation) this.rotation = msg.rotation;
    if (msg.quaternion) this.quaternion = msg.quaternion;
    if (msg.yaw !== undefined) this.yaw = msg.yaw;
    if (msg.pitch !== undefined) this.pitch = msg.pitch;
  }

  tick(dt: number) {
    if (this.isDead) return;
    if (this.isReloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }

    const speed = this.inputs.shift ? SPRINT_SPEED : MOVE_SPEED;
    const forward = { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };

    let moveX = 0;
    let moveZ = 0;
    if (this.inputs.w) { moveX += forward.x; moveZ += forward.z; }
    if (this.inputs.s) { moveX -= forward.x; moveZ -= forward.z; }
    if (this.inputs.d) { moveX += right.x; moveZ += right.z; }
    if (this.inputs.a) { moveX -= right.x; moveZ += right.z; }

    const moveLen = Math.sqrt(moveX*moveX + moveZ*moveZ);
    if (moveLen > 0) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    const control = this.isGrounded ? 1.0 : AIR_CONTROL;
    this.velocity.x += moveX * speed * control * dt * 10;
    this.velocity.z += moveZ * speed * control * dt * 10;

    if (this.isGrounded) {
      this.velocity.x *= Math.max(0, 1 - FRICTION * dt);
      this.velocity.z *= Math.max(0, 1 - FRICTION * dt);
    } else {
      this.velocity.x *= Math.max(0, 1 - FRICTION * 0.1 * dt);
      this.velocity.z *= Math.max(0, 1 - FRICTION * 0.1 * dt);
    }

    if (this.inputs.space && this.isGrounded) {
      this.velocity.y = JUMP_FORCE;
      this.isGrounded = false;
    }

    this.velocity.y -= GRAVITY * dt;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    this.isSprinting = this.inputs.shift && moveLen > 0;
  }

  useAmmo(): boolean {
    if (this.ammo > 0) {
      this.ammo--;
      return true;
    }
    return false;
  }

  reload() {
    if (this.isReloading || this.ammo >= MAG_SIZE || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    this.reloadTimer = RELOAD_TIME;
  }

  finishReload() {
    const needed = MAG_SIZE - this.ammo;
    const available = Math.min(needed, this.reserveAmmo);
    this.ammo += available;
    this.reserveAmmo -= available;
    this.isReloading = false;
  }

  takeDamage(amount: number) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }

  respawn(pos: Vector3) {
    this.position = { ...pos };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.health = MAX_HEALTH;
    this.isDead = false;
    this.ammo = MAG_SIZE;
    this.reserveAmmo = RESERVE_AMMO;
    this.isReloading = false;
  }

  getState(): PlayerState {
    return {
      id: this.id,
      name: this.name,
      position: this.position,
      rotation: this.rotation,
      quaternion: this.quaternion,
      velocity: this.velocity,
      health: this.health,
      score: this.score,
      isDead: this.isDead,
      isSprinting: this.isSprinting,
      isShooting: false,
      weapon: {
        ammo: this.ammo,
        maxAmmo: MAG_SIZE,
        reserveAmmo: this.reserveAmmo,
        isReloading: this.isReloading
      }
    };
  }
}
