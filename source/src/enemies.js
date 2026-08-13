import * as THREE from 'three';
import { resolveSphere, lineOfSight } from './physics.js';

// Shared geometry/material pools so spawning is cheap.
const G = {};
const geo = (k, make) => (G[k] || (G[k] = make()));

export const ENEMY_TYPES = {
  seeker: {
    id: 'seeker', hp: 46, radius: 0.62, speed: 9.2, accel: 26, fly: true, hover: 1.5,
    contactDamage: 11, contactRate: 0.7, score: 100, color: 0xff2e88, cost: 1,
    shards: 14, xpDrop: 0.10,
  },
  spitter: {
    id: 'spitter', hp: 70, radius: 0.72, speed: 4.6, accel: 16, fly: false,
    range: 17, keepDist: 12, fireRate: 1.9, projSpeed: 21, projDamage: 12,
    score: 150, color: 0x6effa0, cost: 2, shards: 16, xpDrop: 0.16,
  },
  brute: {
    id: 'brute', hp: 380, radius: 1.28, speed: 3.5, accel: 11, fly: false,
    contactDamage: 26, contactRate: 1.15, score: 400, color: 0xff8a1e, cost: 5,
    shards: 30, xpDrop: 0.5, armor: 0.28,
  },
  wisp: {
    id: 'wisp', hp: 110, radius: 0.66, speed: 7.4, accel: 30, fly: true, hover: 1.9,
    range: 24, keepDist: 15, fireRate: 2.4, burst: 3, projSpeed: 30, projDamage: 9,
    blink: 3.4, score: 250, color: 0xb26bff, cost: 3, shards: 18, xpDrop: 0.24,
  },
};

function buildSeeker(color) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    geo('seekCore', () => new THREE.OctahedronGeometry(0.55, 0)),
    new THREE.MeshStandardMaterial({ color: 0x2a1030, emissive: color, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.7 })
  );
  core.castShadow = true;
  g.add(core);
  const ring = new THREE.Mesh(
    geo('seekRing', () => new THREE.TorusGeometry(0.78, 0.055, 8, 22)),
    new THREE.MeshBasicMaterial({ color })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const eye = new THREE.Mesh(
    geo('seekEye', () => new THREE.SphereGeometry(0.19, 10, 8)),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  eye.position.z = -0.44;
  g.add(eye);
  return { group: g, core, ring, eye };
}

function buildSpitter(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x14261c, emissive: color, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.5 });
  const body = new THREE.Mesh(geo('spitBody', () => new THREE.CapsuleGeometry(0.5, 0.5, 4, 12)), mat);
  body.position.y = 0.15; body.castShadow = true;
  g.add(body);
  const eye = new THREE.Mesh(geo('spitEye', () => new THREE.SphereGeometry(0.26, 12, 10)), new THREE.MeshBasicMaterial({ color }));
  eye.position.set(0, 0.42, -0.36);
  g.add(eye);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(geo('spitLeg', () => new THREE.CylinderGeometry(0.07, 0.04, 0.9, 6)), mat);
    leg.position.set(Math.cos(a) * 0.34, -0.5, Math.sin(a) * 0.34);
    leg.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35);
    leg.castShadow = true;
    g.add(leg);
  }
  return { group: g, core: body, eye };
}

function buildBrute(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x33180c, emissive: color, emissiveIntensity: 0.35, roughness: 0.55, metalness: 0.6 });
  const torso = new THREE.Mesh(geo('bruteTorso', () => new THREE.BoxGeometry(1.7, 1.5, 1.15)), mat);
  torso.position.y = 0.55; torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(geo('bruteHead', () => new THREE.BoxGeometry(0.72, 0.6, 0.7)), mat);
  head.position.y = 1.6; head.castShadow = true;
  g.add(head);
  const visor = new THREE.Mesh(geo('bruteVisor', () => new THREE.BoxGeometry(0.6, 0.14, 0.06)), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
  visor.position.set(0, 1.62, -0.37);
  g.add(visor);
  const chest = new THREE.Mesh(geo('bruteChest', () => new THREE.SphereGeometry(0.34, 12, 10)), new THREE.MeshBasicMaterial({ color }));
  chest.position.set(0, 0.72, -0.56);
  g.add(chest);
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(geo('bruteArm', () => new THREE.BoxGeometry(0.5, 1.5, 0.5)), mat);
    arm.position.set(s * 1.16, 0.5, 0);
    arm.castShadow = true;
    g.add(arm); arms.push(arm);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(geo('bruteLeg', () => new THREE.BoxGeometry(0.56, 1.1, 0.6)), mat);
    leg.position.set(s * 0.44, -0.65, 0);
    leg.castShadow = true;
    g.add(leg); legs.push(leg);
  }
  return { group: g, core: torso, arms, legs, chest, head };
}

function buildWisp(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c1030, emissive: color, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.95 });
  const body = new THREE.Mesh(geo('wispBody', () => new THREE.ConeGeometry(0.5, 1.5, 10)), mat);
  body.rotation.x = Math.PI;
  body.castShadow = true;
  g.add(body);
  const halo = new THREE.Mesh(geo('wispHalo', () => new THREE.TorusGeometry(0.62, 0.045, 6, 20)), new THREE.MeshBasicMaterial({ color }));
  halo.position.y = 0.72;
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  const eye = new THREE.Mesh(geo('wispEye', () => new THREE.SphereGeometry(0.17, 10, 8)), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  eye.position.set(0, 0.34, -0.3);
  g.add(eye);
  const tendrils = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const t = new THREE.Mesh(geo('wispTen', () => new THREE.CylinderGeometry(0.05, 0.01, 1.0, 5)), mat);
    t.position.set(Math.cos(a) * 0.26, -0.9, Math.sin(a) * 0.26);
    g.add(t); tendrils.push(t);
  }
  return { group: g, core: body, halo, tendrils, eye };
}

const BUILD = { seeker: buildSeeker, spitter: buildSpitter, brute: buildBrute, wisp: buildWisp };

let NEXT_ID = 1;

export class Enemy {
  constructor(typeId, scene, hpScale = 1, speedScale = 1) {
    const T = ENEMY_TYPES[typeId];
    this.id = NEXT_ID++;
    this.T = T;
    this.type = typeId;
    this.maxHp = Math.round(T.hp * hpScale);
    this.hp = this.maxHp;
    this.r = T.radius;
    this.speedScale = speedScale;
    this.p = new THREE.Vector3();
    this.v = new THREE.Vector3();
    this.dead = false;
    this.spawnT = 0;         // spawn-in animation
    this.attackCd = 0;
    this.fireCd = Math.random() * 1.2;
    this.blinkCd = 2 + Math.random() * 2;
    this.burstLeft = 0;
    this.burstCd = 0;
    this.hitFlash = 0;
    this.stun = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    this.strafeT = 1 + Math.random() * 2;
    this.bobPhase = Math.random() * Math.PI * 2;
    this.yaw = 0;
    this.slamT = 0;
    this.knock = new THREE.Vector3();

    const built = BUILD[typeId](T.color);
    this.mesh = built.group;
    this.parts = built;
    this.baseEmissive = built.core.material.emissiveIntensity ?? 0;
    // Per-instance material so hit flashes don't affect siblings.
    built.core.material = built.core.material.clone();
    scene.add(this.mesh);

    this.glowLight = new THREE.PointLight(T.color, 6, 7, 2);
    this.mesh.add(this.glowLight);
  }

  get bodyCenter() { return this.p; }
  headCenter(out) { return out.set(this.p.x, this.p.y + this.r * 0.92, this.p.z); }
  get headRadius() { return this.r * 0.52; }

  spawnAt(v) {
    this.p.copy(v);
    this.p.y += this.T.fly ? this.T.hover + this.r : this.r;
    this.mesh.position.copy(this.p);
    this.spawnT = 1;
  }

  damage(amount) {
    const armored = this.T.armor ? amount * (1 - this.T.armor) : amount;
    this.hp -= armored;
    this.hitFlash = 1;
    return armored;
  }

  update(dt, ctx) {
    const T = this.T;
    const { player, boxes, fx, audio, projectiles, time } = ctx;
    if (this.spawnT > 0) {
      this.spawnT = Math.max(0, this.spawnT - dt * 1.6);
      const k = 1 - this.spawnT;
      this.mesh.scale.setScalar(0.05 + k * k * 0.95);
      this.mesh.rotation.y += dt * 9 * this.spawnT;
      if (this.spawnT > 0.35) { this.mesh.position.copy(this.p); return; }
    } else {
      this.mesh.scale.setScalar(1);
    }

    this.hitFlash = Math.max(0, this.hitFlash - dt * 5);
    this.stun = Math.max(0, this.stun - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.blinkCd = Math.max(0, this.blinkCd - dt);
    this.burstCd = Math.max(0, this.burstCd - dt);

    const toP = _v1.subVectors(player.pos, this.p);
    toP.y += 1.0;
    const dist = toP.length();
    const dir = _v2.copy(toP).normalize();
    const flat = _v3.set(dir.x, 0, dir.z).normalize();

    const speed = T.speed * this.speedScale * (this.stun > 0 ? 0.15 : 1);
    const desired = _v4.set(0, 0, 0);

    if (T.id === 'seeker') {
      desired.copy(flat).multiplyScalar(speed);
      // gentle weave so a swarm doesn't collapse into a line
      desired.x += Math.cos(time * 2.2 + this.bobPhase) * speed * 0.25;
      desired.z += Math.sin(time * 2.0 + this.bobPhase) * speed * 0.25;
      const targetY = player.pos.y + 1.1 + Math.sin(time * 2.6 + this.bobPhase) * 0.5;
      this.v.y += (targetY - this.p.y) * 3.4 * dt;
      this.v.y *= Math.pow(0.9, dt * 60);
      if (dist < this.r + 1.2 && this.attackCd <= 0) {
        player.takeDamage(T.contactDamage, this.p);
        this.attackCd = T.contactRate;
        fx.burst(this.p, 12, { speed: 7, life: 0.3, size: 0.2, color: [1, 0.25, 0.5], grav: -2 });
        this.v.addScaledVector(flat, -9);
      }
    } else if (T.id === 'brute') {
      desired.copy(flat).multiplyScalar(speed);
      this.v.y -= 26 * dt;
      if (dist < this.r + 1.9 && this.attackCd <= 0) {
        player.takeDamage(T.contactDamage, this.p);
        this.attackCd = T.contactRate;
        fx.ring(_v5.set(this.p.x, this.p.y - this.r + 0.1, this.p.z), { color: 0xff8a1e, from: 0.5, to: 4.5, life: 0.45 });
        audio.explode();
        this.slamT = 0.35;
      }
    } else if (T.id === 'spitter') {
      const see = lineOfSight(this.p, _v5.copy(player.pos).setY(player.pos.y + 1.2), boxes);
      if (dist > T.keepDist + 2) desired.copy(flat).multiplyScalar(speed);
      else if (dist < T.keepDist - 3) desired.copy(flat).multiplyScalar(-speed * 0.8);
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 1.4 + Math.random() * 1.8; }
      desired.x += -flat.z * this.strafeDir * speed * 0.75;
      desired.z += flat.x * this.strafeDir * speed * 0.75;
      this.v.y -= 26 * dt;
      if (see && dist < T.range && this.fireCd <= 0 && this.stun <= 0) {
        this.fireCd = T.fireRate * (0.8 + Math.random() * 0.4);
        this._shoot(ctx, dir, T.projSpeed, T.projDamage, 0.34, T.color);
      }
    } else if (T.id === 'wisp') {
      const see = lineOfSight(this.p, _v5.copy(player.pos).setY(player.pos.y + 1.2), boxes);
      if (dist > T.keepDist + 3) desired.copy(flat).multiplyScalar(speed);
      else if (dist < T.keepDist - 4) desired.copy(flat).multiplyScalar(-speed);
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeDir *= -1; this.strafeT = 0.9 + Math.random() * 1.2; }
      desired.x += -flat.z * this.strafeDir * speed;
      desired.z += flat.x * this.strafeDir * speed;
      const targetY = player.pos.y + 1.6 + Math.sin(time * 3 + this.bobPhase) * 0.6;
      this.v.y += (targetY - this.p.y) * 3.6 * dt;
      this.v.y *= Math.pow(0.88, dt * 60);
      if (this.blinkCd <= 0 && dist < 30 && this.stun <= 0) {
        this.blinkCd = T.blink * (0.7 + Math.random() * 0.6);
        const a = Math.random() * Math.PI * 2;
        const rr = 8 + Math.random() * 7;
        const nx = player.pos.x + Math.cos(a) * rr, nz = player.pos.z + Math.sin(a) * rr;
        fx.burst(this.p, 22, { speed: 8, life: 0.45, size: 0.18, color: [0.7, 0.42, 1], grav: 0 });
        fx.ring(this.p, { color: 0xb26bff, from: 0.3, to: 2.6, life: 0.35, billboard: true });
        this.p.set(THREE.MathUtils.clamp(nx, -30, 30), player.pos.y + 2.0, THREE.MathUtils.clamp(nz, -30, 30));
        resolveSphere(this.p, this.r, boxes);
        fx.burst(this.p, 22, { speed: 8, life: 0.45, size: 0.18, color: [0.7, 0.42, 1], grav: 0 });
        audio.spawnPortal();
      }
      if (see && dist < T.range && this.fireCd <= 0 && this.stun <= 0 && this.burstLeft <= 0) {
        this.burstLeft = T.burst;
        this.fireCd = T.fireRate;
      }
      if (this.burstLeft > 0 && this.burstCd <= 0) {
        this.burstLeft--;
        this.burstCd = 0.13;
        this._shoot(ctx, dir, T.projSpeed, T.projDamage, 0.26, T.color);
      }
    }

    // steer toward desired horizontal velocity
    const a = T.accel * dt;
    this.v.x += (desired.x - this.v.x) * Math.min(1, a);
    this.v.z += (desired.z - this.v.z) * Math.min(1, a);
    this.v.add(this.knock);
    this.knock.multiplyScalar(Math.pow(0.02, dt));

    this.p.addScaledVector(this.v, dt);

    // world collision
    if (!T.fly) {
      if (this.p.y < this.r) { this.p.y = this.r; this.v.y = 0; }
    } else {
      if (this.p.y < this.r + 0.4) { this.p.y = this.r + 0.4; this.v.y = Math.max(0, this.v.y); }
    }
    const wasY = this.p.y;
    if (resolveSphere(this.p, this.r, boxes)) {
      if (!T.fly && this.p.y > wasY) this.v.y = Math.max(0, this.v.y);
    }
    const LIM = 31.5;
    this.p.x = THREE.MathUtils.clamp(this.p.x, -LIM, LIM);
    this.p.z = THREE.MathUtils.clamp(this.p.z, -LIM, LIM);

    // orientation + visuals
    const wantYaw = Math.atan2(flat.x, flat.z) + Math.PI;
    let d = wantYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 8);

    this.mesh.position.copy(this.p);
    if (!T.fly) this.mesh.position.y = this.p.y - this.r;
    this.mesh.rotation.y = this.yaw;

    const P = this.parts;
    if (T.id === 'seeker') {
      P.ring.rotation.z += dt * 6;
      P.core.rotation.y += dt * 3;
      this.mesh.position.y += Math.sin(time * 4 + this.bobPhase) * 0.1;
    } else if (T.id === 'wisp') {
      P.halo.rotation.z += dt * 3.5;
      for (let i = 0; i < P.tendrils.length; i++) {
        P.tendrils[i].rotation.x = Math.sin(time * 4 + i) * 0.3;
        P.tendrils[i].rotation.z = Math.cos(time * 3.4 + i) * 0.3;
      }
    } else if (T.id === 'brute') {
      const w = Math.sin(time * 7) * Math.min(1, this.v.length() / 4);
      P.legs[0].rotation.x = w * 0.6; P.legs[1].rotation.x = -w * 0.6;
      P.arms[0].rotation.x = -w * 0.5; P.arms[1].rotation.x = w * 0.5;
      if (this.slamT > 0) {
        this.slamT -= dt;
        P.arms[0].rotation.x = -1.4; P.arms[1].rotation.x = -1.4;
      }
    } else if (T.id === 'spitter') {
      const w = Math.sin(time * 9) * Math.min(1, this.v.length() / 3);
      this.mesh.position.y += Math.abs(w) * 0.08;
      P.eye.scale.setScalar(1 + Math.sin(time * 5 + this.bobPhase) * 0.12);
    }

    // hit flash
    const mat = P.core.material;
    if (mat.emissive) {
      const f = this.hitFlash * 0.75;
      mat.emissiveIntensity = this.baseEmissive + this.hitFlash * 2.6;
      mat.emissive.setRGB(
        THREE.MathUtils.lerp((T.color >> 16 & 255) / 255, 1, f),
        THREE.MathUtils.lerp((T.color >> 8 & 255) / 255, 1, f),
        THREE.MathUtils.lerp((T.color & 255) / 255, 1, f)
      );
    }
    this.glowLight.intensity = 5 + this.hitFlash * 26;
    void projectiles;
  }

  _shoot(ctx, dir, speed, dmg, spread, color) {
    const { projectiles, audio, fx } = ctx;
    const d = _v6.copy(dir);
    d.x += (Math.random() - 0.5) * spread;
    d.y += (Math.random() - 0.5) * spread * 0.6;
    d.z += (Math.random() - 0.5) * spread;
    d.normalize();
    const origin = _v5.copy(this.p).addScaledVector(d, this.r + 0.35);
    projectiles.spawn(origin, d, speed, dmg, color);
    audio.enemyShoot();
    fx.burst(origin, 6, { speed: 4, life: 0.22, size: 0.16, color: [((color >> 16 & 255) / 255), ((color >> 8 & 255) / 255), ((color & 255) / 255)], grav: 0 });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.traverse(o => { if (o.isMesh && o.material && o.material.dispose && o.material._cloned) o.material.dispose(); });
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3(), _v6 = new THREE.Vector3();

// ---------------- Enemy projectiles ----------------
const MAX_PROJ = 160;

export class ProjectilePool {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    const g = new THREE.SphereGeometry(0.19, 10, 8);
    for (let i = 0; i < MAX_PROJ; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const m = new THREE.Mesh(g, mat);
      m.visible = false;
      m.frustumCulled = false;
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.add(halo);
      scene.add(m);
      this.list.push({ mesh: m, halo, alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), dmg: 0, life: 0 });
    }
  }

  spawn(pos, dir, speed, dmg, color) {
    const p = this.list.find(x => !x.alive);
    if (!p) return;
    p.alive = true;
    p.p.copy(pos);
    p.v.copy(dir).multiplyScalar(speed);
    p.dmg = dmg;
    p.life = 5;
    p.mesh.position.copy(pos);
    p.mesh.material.color.setHex(color);
    p.halo.material.color.setHex(color);
    p.mesh.visible = true;
  }

  update(dt, ctx) {
    const { player, boxes, fx, audio } = ctx;
    for (const p of this.list) {
      if (!p.alive) continue;
      p.life -= dt;
      const steps = 2;
      for (let s = 0; s < steps; s++) {
        p.p.addScaledVector(p.v, dt / steps);
        // player hit
        const dx = p.p.x - player.pos.x, dy = p.p.y - (player.pos.y + 0.95), dz = p.p.z - player.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.72 * 0.72) {
          player.takeDamage(p.dmg, p.p);
          this._pop(p, fx, audio);
          break;
        }
        if (p.p.y < 0.05) { this._pop(p, fx, audio); break; }
        let hitWorld = false;
        for (const b of boxes) {
          if (p.p.x > b.min.x && p.p.x < b.max.x && p.p.y > b.min.y && p.p.y < b.max.y && p.p.z > b.min.z && p.p.z < b.max.z) { hitWorld = true; break; }
        }
        if (hitWorld) { this._pop(p, fx, audio); break; }
      }
      if (!p.alive) continue;
      if (p.life <= 0) { p.alive = false; p.mesh.visible = false; continue; }
      p.mesh.position.copy(p.p);
      p.halo.scale.setScalar(1 + Math.sin(p.life * 30) * 0.15);
      if (Math.random() < 0.5) {
        const c = p.mesh.material.color;
        fx.spawnParticle({ x: p.p.x, y: p.p.y, z: p.p.z, vx: 0, vy: 0, vz: 0, life: 0.25, size: 0.16, r: c.r, g: c.g, b: c.b, drag: 0.9, grav: 0 });
      }
    }
  }

  _pop(p, fx, audio) {
    p.alive = false;
    p.mesh.visible = false;
    const c = p.mesh.material.color;
    fx.burst(p.p, 10, { speed: 6, life: 0.3, size: 0.16, color: [c.r, c.g, c.b], grav: -3 });
    fx.flash(p.p, p.mesh.material.color.getHex(), 12, 0.12, 8);
    void audio;
  }

  clear() {
    for (const p of this.list) { p.alive = false; p.mesh.visible = false; }
  }
}
