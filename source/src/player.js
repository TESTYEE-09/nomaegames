import * as THREE from 'three';
import { moveAndCollide } from './physics.js';
import { WEAPONS } from './weapons.js';

const PLAYER_R = 0.38;
const PLAYER_H = 1.8;
const EYE = 1.62;

export class Player {
  constructor(arena) {
    this.arena = arena;
    this.pos = new THREE.Vector3(0, 0, 24);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.wasGrounded = false;
    this.jumpsLeft = 2;
    this.coyote = 0;
    this.jumpBuffer = 0;

    // dash
    this.dashCharges = 2;
    this.dashMax = 2;
    this.dashCd = 0;
    this.dashRecharge = 2.2;
    this.dashT = 0;
    this.dashDir = new THREE.Vector3();

    // stats (mutated by upgrades)
    this.stats = {
      maxHp: 100, speed: 8.2, damageMul: 1, fireRateMul: 1, reloadMul: 1,
      magMul: 1, critChance: 0.05, critMul: 2.0, headshotMul: 2.0,
      lifesteal: 0, explosive: 0, shieldMax: 0, regenDelay: 4.5, regenRate: 14,
      pickupRange: 3.0, jumps: 2, dashMax: 2,
    };
    this.hp = 100;
    this.shield = 0;
    this.hurtT = 0;
    this.regenT = 0;
    this.dead = false;

    // weapons
    this.unlocked = [true, false, false];
    this.weaponIndex = 0;
    this.ammo = WEAPONS.map(w => w.mag);
    this.reserve = WEAPONS.map(() => 999);
    this.reloading = false;
    this.reloadT = 0;
    this.fireT = 0;
    this.chargeT = 0;
    this.spreadHeat = 0;
    this.recoilV = 0; this.recoilH = 0;
    this.recoilRecov = new THREE.Vector2();

    this.moveAmt = 0;
    this.speedNow = 0;
    this.landImpact = 0;
    this.onDamage = null;
    this.onDeath = null;
  }

  get weapon() { return WEAPONS[this.weaponIndex]; }
  get magSize() { return Math.round(this.weapon.mag * this.stats.magMul); }

  reset() {
    this.pos.set(0, 0, 24);
    this.vel.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.hp = this.stats.maxHp;
    this.shield = this.stats.shieldMax;
    this.dead = false;
    this.dashCharges = this.stats.dashMax;
    this.ammo = WEAPONS.map((w, i) => Math.round(w.mag * this.stats.magMul) * (i === 0 ? 1 : 1));
    this.reloading = false; this.reloadT = 0; this.fireT = 0; this.chargeT = 0;
    this.weaponIndex = 0;
    this.unlocked = [true, false, false];
  }

  look(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }

  takeDamage(amount, from) {
    if (this.dead) return;
    let dmg = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
    }
    this.hp -= dmg;
    this.hurtT = 1;
    this.regenT = this.stats.regenDelay;
    if (this.onDamage) this.onDamage(amount, from);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      if (this.onDeath) this.onDeath();
    }
  }

  heal(n) {
    this.hp = Math.min(this.stats.maxHp, this.hp + n);
  }

  addDash() {
    this.dashCharges = Math.min(this.stats.dashMax, this.dashCharges + 1);
  }

  update(dt, input, boxes, audio, fx) {
    const s = this.stats;
    this.hurtT = Math.max(0, this.hurtT - dt * 2);
    this.fireT = Math.max(0, this.fireT - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.coyote = Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.landImpact = Math.max(0, this.landImpact - dt * 3);

    // shield / health regen
    if (this.regenT > 0) this.regenT -= dt;
    else {
      if (this.shield < s.shieldMax) this.shield = Math.min(s.shieldMax, this.shield + s.regenRate * dt);
      else if (s.regenHealth) this.hp = Math.min(s.maxHp, this.hp + s.regenHealth * dt);
    }

    // dash recharge
    if (this.dashCharges < s.dashMax) {
      this.dashCd -= 0;
      this._dashTimer = (this._dashTimer || 0) + dt;
      if (this._dashTimer >= this.dashRecharge) { this._dashTimer = 0; this.dashCharges++; }
    } else this._dashTimer = 0;

    // ---- movement input ----
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    if (input.fwd) wish.add(f);
    if (input.back) wish.sub(f);
    if (input.right) wish.add(r);
    if (input.left) wish.sub(r);
    const moving = wish.lengthSq() > 0.0001;
    if (moving) wish.normalize();
    this.moveAmt += ((moving && this.grounded ? 1 : 0) - this.moveAmt) * Math.min(1, dt * 10);

    // dash
    if (input.dashPressed && this.dashCharges > 0 && this.dashT <= 0) {
      this.dashCharges--;
      this.dashT = 0.17;
      this.dashDir.copy(moving ? wish : f).normalize();
      audio.dash();
      fx.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.9, this.pos.z), 26, {
        speed: 9, life: 0.35, size: 0.2, color: [0.4, 0.95, 1], grav: -1,
        dir: { x: -this.dashDir.x, y: 0.15, z: -this.dashDir.z }, spread: 0.5,
      });
      this.dashFlash = 1;
    }

    const sprint = input.sprint && !input.back ? 1.28 : 1;
    const targetSpeed = s.speed * sprint;

    if (this.dashT > 0) {
      this.dashT -= dt;
      const boost = 26;
      this.vel.x = this.dashDir.x * boost;
      this.vel.z = this.dashDir.z * boost;
      if (this.vel.y < 0) this.vel.y *= 0.4;
      fx.spawnParticle({
        x: this.pos.x, y: this.pos.y + 0.9, z: this.pos.z,
        vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, vz: (Math.random() - 0.5) * 2,
        life: 0.3, size: 0.22, r: 0.4, g: 0.9, b: 1, drag: 0.9, grav: 0,
      });
    } else {
      const accel = this.grounded ? 62 : 26;
      const friction = this.grounded ? 12 : 1.1;
      const desired = wish.clone().multiplyScalar(targetSpeed);
      const dvx = desired.x - this.vel.x;
      const dvz = desired.z - this.vel.z;
      if (moving) {
        this.vel.x += THREE.MathUtils.clamp(dvx, -accel * dt, accel * dt);
        this.vel.z += THREE.MathUtils.clamp(dvz, -accel * dt, accel * dt);
      } else {
        const damp = Math.pow(0.0001, dt * (friction / 12));
        this.vel.x *= damp;
        this.vel.z *= damp;
      }
    }

    // jump
    if (input.jumpPressed) this.jumpBuffer = 0.14;
    const canGround = this.grounded || this.coyote > 0;
    if (this.jumpBuffer > 0 && (canGround || this.jumpsLeft > 0)) {
      if (canGround) { this.jumpsLeft = s.jumps - 1; this.coyote = 0; }
      else {
        this.jumpsLeft--;
        fx.ring(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), { color: 0x2ee6ff, from: 0.3, to: 2.2, life: 0.35 });
        fx.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.15, this.pos.z), 16, { speed: 5, life: 0.35, size: 0.16, color: [0.3, 0.9, 1], grav: -4 });
      }
      this.vel.y = 9.6;
      this.jumpBuffer = 0;
      this.grounded = false;
      audio.jump();
    }

    // gravity
    const gravity = this.vel.y > 0 && input.jumpHeld ? 24 : 34;
    this.vel.y -= gravity * dt;
    this.vel.y = Math.max(this.vel.y, -55);

    // integrate + collide
    const delta = new THREE.Vector3(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    const res = moveAndCollide(this.pos, delta, PLAYER_R, PLAYER_H, boxes, 0.62);
    if (res.hitX) this.vel.x = 0;
    if (res.hitZ) this.vel.z = 0;
    if (res.ceiling) this.vel.y = Math.min(0, this.vel.y);

    this.wasGrounded = this.grounded;
    this.grounded = res.grounded;
    if (this.grounded) {
      if (!this.wasGrounded) {
        const impact = Math.min(1, Math.abs(this.vel.y) / 30);
        if (impact > 0.08) {
          audio.land(impact);
          this.landImpact = impact;
          if (impact > 0.4) {
            fx.ring(new THREE.Vector3(this.pos.x, this.pos.y + 0.05, this.pos.z), { color: 0x9ff6ff, from: 0.4, to: 2.6 + impact * 2, life: 0.35 });
            fx.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), 14, { speed: 5, life: 0.3, size: 0.14, color: [0.6, 0.9, 1], grav: -8 });
          }
        }
      }
      this.vel.y = Math.max(0, this.vel.y);
      this.jumpsLeft = s.jumps - 1;
      this.coyote = 0.12;
    } else if (this.wasGrounded) {
      this.coyote = 0.12;
    }

    this.speedNow = Math.hypot(this.vel.x, this.vel.z);

    // recoil recovery
    this.recoilV *= Math.pow(0.0006, dt);
    this.recoilH *= Math.pow(0.0006, dt);
    this.spreadHeat = Math.max(0, this.spreadHeat - dt * 0.9);

    if (this.dashFlash) this.dashFlash = Math.max(0, this.dashFlash - dt * 4);
  }

  eyePos(out) {
    return out.set(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  forward(out) {
    const cp = Math.cos(this.pitch + this.recoilV * 0.01), sp = Math.sin(this.pitch + this.recoilV * 0.01);
    const y = this.yaw + this.recoilH * 0.01;
    return out.set(-Math.sin(y) * cp, sp, -Math.cos(y) * cp).normalize();
  }

  currentSpread() {
    const w = this.weapon;
    let sp = w.spread + this.spreadHeat;
    if (!this.grounded) sp += w.spreadAir;
    sp += Math.min(1, this.speedNow / this.stats.speed) * w.spreadMove;
    return Math.min(sp, w.spreadMax + this.spreadHeat);
  }
}

export { PLAYER_R, PLAYER_H, EYE };
