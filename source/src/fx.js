import * as THREE from 'three';

const MAX_PARTICLES = 5000;
const MAX_SHARDS = 900;
const MAX_TRACERS = 64;
const MAX_RINGS = 24;
const MAX_DECALS = 90;

const PARTICLE_VS = `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (320.0 / max(0.001, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FS = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.02, d);
  gl_FragColor = vec4(vColor * (0.6 + a * 1.4), a * vAlpha);
}`;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this._initParticles();
    this._initShards();
    this._initTracers();
    this._initRings();
    this._initDecals();
    this._initLights();
  }

  // ---------------- Particles ----------------
  _initParticles() {
    const g = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.pSize = new Float32Array(MAX_PARTICLES);
    this.pAlpha = new Float32Array(MAX_PARTICLES);
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1));
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    const m = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, drag: 0.98, grav: 0, r: 1, g: 1, b: 1, fade: 1 });
    }
    this.pCursor = 0;
  }

  spawnParticle(o) {
    let p = null;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const idx = (this.pCursor + i) % MAX_PARTICLES;
      if (!this.parts[idx].alive) { p = this.parts[idx]; this.pCursor = (idx + 1) % MAX_PARTICLES; break; }
    }
    if (!p) return;
    p.alive = true;
    p.x = o.x; p.y = o.y; p.z = o.z;
    p.vx = o.vx; p.vy = o.vy; p.vz = o.vz;
    p.life = p.max = o.life;
    p.size = o.size;
    p.drag = o.drag ?? 0.94;
    p.grav = o.grav ?? 0;
    p.r = o.r; p.g = o.g; p.b = o.b;
    p.fade = o.fade ?? 1;
  }

  burst(pos, n, opts = {}) {
    const {
      speed = 6, spread = 1, life = 0.5, size = 0.16, color = [1, 0.6, 0.2],
      dir = null, grav = -9, drag = 0.9, sizeVar = 0.6, colorVar = 0.15,
    } = opts;
    for (let i = 0; i < n; i++) {
      let vx, vy, vz;
      if (dir) {
        const t = Math.random() * Math.PI * 2, u = Math.random();
        const rx = Math.cos(t) * u * spread, ry = Math.sin(t) * u * spread;
        // build a basis around dir
        const up = Math.abs(dir.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
        const ax = { x: up.y * dir.z - up.z * dir.y, y: up.z * dir.x - up.x * dir.z, z: up.x * dir.y - up.y * dir.x };
        const al = Math.hypot(ax.x, ax.y, ax.z) || 1;
        ax.x /= al; ax.y /= al; ax.z /= al;
        const ay = { x: dir.y * ax.z - dir.z * ax.y, y: dir.z * ax.x - dir.x * ax.z, z: dir.x * ax.y - dir.y * ax.x };
        const s = speed * (0.35 + Math.random() * 0.9);
        vx = (dir.x + ax.x * rx + ay.x * ry) * s;
        vy = (dir.y + ax.y * rx + ay.y * ry) * s;
        vz = (dir.z + ax.z * rx + ay.z * ry) * s;
      } else {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(Math.random() * 2 - 1);
        const s = speed * (0.25 + Math.random() * 1.0);
        vx = Math.sin(ph) * Math.cos(th) * s;
        vy = Math.cos(ph) * s;
        vz = Math.sin(ph) * Math.sin(th) * s;
      }
      const cv = () => 1 + (Math.random() - 0.5) * colorVar * 2;
      this.spawnParticle({
        x: pos.x, y: pos.y, z: pos.z, vx, vy, vz,
        life: life * (0.6 + Math.random() * 0.8),
        size: size * (1 - sizeVar / 2 + Math.random() * sizeVar),
        grav, drag,
        r: color[0] * cv(), g: color[1] * cv(), b: color[2] * cv(),
      });
    }
  }

  // ---------------- Shards (debris chunks) ----------------
  _initShards() {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.shardMesh = new THREE.InstancedMesh(geo, mat, MAX_SHARDS);
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.frustumCulled = false;
    this.shardMesh.count = 0;
    const colors = new Float32Array(MAX_SHARDS * 3);
    this.shardMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.shardMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.shardMesh);
    this.shards = [];
    for (let i = 0; i < MAX_SHARDS; i++) {
      this.shards.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), av: new THREE.Vector3(), s: new THREE.Vector3(), life: 0, max: 1, col: new THREE.Color() });
    }
    this._m4 = new THREE.Matrix4();
    this._sq = new THREE.Quaternion();
    this._sv = new THREE.Vector3();
  }

  shardBurst(pos, n, color, opts = {}) {
    const { speed = 7, size = 0.22, life = 1.5, up = 3 } = opts;
    let made = 0;
    for (let i = 0; i < MAX_SHARDS && made < n; i++) {
      const s = this.shards[i];
      if (s.alive) continue;
      s.alive = true;
      s.p.copy(pos);
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.3 + Math.random());
      s.v.set(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.6 + up, Math.sin(ph) * Math.sin(th) * sp);
      s.av.set((Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22);
      s.q.set(Math.random(), Math.random(), Math.random(), Math.random()).normalize();
      const k = size * (0.4 + Math.random() * 1.2);
      s.s.set(k, k * (0.4 + Math.random()), k * (0.4 + Math.random()));
      s.life = s.max = life * (0.6 + Math.random() * 0.8);
      s.col.setRGB(color[0], color[1], color[2]);
      made++;
    }
  }

  // ---------------- Tracers ----------------
  _initTracers() {
    this.tracers = [];
    const geo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2); // along +Z
    for (let i = 0; i < MAX_TRACERS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.scene.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 1, w: 0.04 });
    }
  }

  tracer(from, to, color = 0x9ff6ff, width = 0.035, life = 0.09) {
    const t = this.tracers.find(x => x.life <= 0);
    if (!t) return;
    const d = new THREE.Vector3().subVectors(to, from);
    const len = d.length();
    if (len < 0.01) return;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(width, width, len);
    t.mesh.material.color.setHex(color);
    t.mesh.material.opacity = 1;
    t.mesh.visible = true;
    t.life = t.max = life;
    t.w = width;
  }

  // ---------------- Shock rings ----------------
  _initRings() {
    this.rings = [];
    const geo = new THREE.RingGeometry(0.82, 1, 40);
    for (let i = 0; i < MAX_RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false; m.frustumCulled = false;
      this.scene.add(m);
      this.rings.push({ mesh: m, life: 0, max: 1, from: 0.4, to: 4, billboard: false });
    }
  }

  ring(pos, opts = {}) {
    const { color = 0xffffff, from = 0.3, to = 4, life = 0.4, billboard = false, normal = null } = opts;
    const r = this.rings.find(x => x.life <= 0);
    if (!r) return;
    r.mesh.position.copy(pos);
    r.mesh.visible = true;
    r.mesh.material.color.setHex(color);
    r.mesh.material.opacity = 1;
    r.life = r.max = life; r.from = from; r.to = to; r.billboard = billboard;
    if (normal) r.mesh.lookAt(pos.x + normal.x, pos.y + normal.y, pos.z + normal.z);
    else if (!billboard) r.mesh.rotation.set(-Math.PI / 2, 0, 0);
    r.mesh.scale.setScalar(from);
  }

  // ---------------- Impact decals ----------------
  _initDecals() {
    this.decals = [];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(180,220,255,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    const geo = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < MAX_DECALS; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.visible = false; m.frustumCulled = false;
      this.scene.add(m);
      this.decals.push({ mesh: m, life: 0, max: 1 });
    }
  }

  decal(pos, normal, color = 0x8fe8ff, size = 0.6, life = 2.5) {
    const d = this.decals.find(x => x.life <= 0);
    if (!d) return;
    d.mesh.position.copy(pos).addScaledVector(normal, 0.02);
    d.mesh.lookAt(pos.x + normal.x, pos.y + normal.y, pos.z + normal.z);
    d.mesh.scale.setScalar(size);
    d.mesh.material.color.setHex(color);
    d.mesh.material.opacity = 1;
    d.mesh.visible = true;
    d.life = d.max = life;
  }

  // ---------------- Dynamic flash lights ----------------
  _initLights() {
    this.flashes = [];
    for (let i = 0; i < 8; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 22, 2);
      l.visible = false;
      this.scene.add(l);
      this.flashes.push({ light: l, life: 0, max: 1, power: 0 });
    }
  }

  flash(pos, color = 0xffdca8, power = 40, life = 0.09, dist = 20) {
    const f = this.flashes.find(x => x.life <= 0) || this.flashes[0];
    f.light.position.copy(pos);
    f.light.color.setHex(color);
    f.light.distance = dist;
    f.light.visible = true;
    f.life = f.max = life; f.power = power;
  }

  // ---------------- Update ----------------
  update(dt) {
    this.time += dt;

    // particles
    let count = 0;
    const pos = this.pPos, col = this.pCol, siz = this.pSize, alp = this.pAlpha;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.02 && p.vy < 0) { p.y = 0.02; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.life / p.max;
      const i3 = count * 3;
      pos[i3] = p.x; pos[i3 + 1] = p.y; pos[i3 + 2] = p.z;
      col[i3] = p.r; col[i3 + 1] = p.g; col[i3 + 2] = p.b;
      siz[count] = p.size * (0.35 + k * 0.65);
      alp[count] = Math.min(1, k * p.fade * 1.6);
      count++;
    }
    const g = this.points.geometry;
    g.setDrawRange(0, count);
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;

    // shards
    let sc = 0;
    for (let i = 0; i < MAX_SHARDS; i++) {
      const s = this.shards[i];
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) { s.alive = false; continue; }
      s.v.y -= 22 * dt;
      s.v.multiplyScalar(Math.pow(0.985, dt * 60));
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.05) { s.p.y = 0.05; s.v.y *= -0.4; s.v.x *= 0.7; s.v.z *= 0.7; s.av.multiplyScalar(0.6); }
      this._sq.setFromAxisAngle(this._sv.copy(s.av).normalize(), s.av.length() * dt);
      s.q.premultiply(this._sq);
      const k = Math.min(1, s.life / s.max * 2.2);
      this._m4.compose(s.p, s.q, this._sv.copy(s.s).multiplyScalar(k));
      this.shardMesh.setMatrixAt(sc, this._m4);
      this.shardMesh.instanceColor.setXYZ(sc, s.col.r * k, s.col.g * k, s.col.b * k);
      sc++;
    }
    this.shardMesh.count = sc;
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceColor.needsUpdate = true;

    // tracers
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const k = Math.max(0, t.life / t.max);
      t.mesh.material.opacity = k * k;
      t.mesh.scale.x = t.mesh.scale.y = t.w * (0.35 + k * 0.65);
      if (t.life <= 0) t.mesh.visible = false;
    }

    // rings
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = 1 - r.life / r.max;
      const s = r.from + (r.to - r.from) * (1 - Math.pow(1 - k, 2.4));
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = Math.max(0, 1 - k) * 0.9;
      if (r.life <= 0) r.mesh.visible = false;
    }

    // decals
    for (const d of this.decals) {
      if (d.life <= 0) continue;
      d.life -= dt;
      const k = d.life / d.max;
      d.mesh.material.opacity = Math.min(1, k * 1.4) * 0.85;
      if (d.life <= 0) d.mesh.visible = false;
    }

    // flash lights
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.light.intensity = f.power * k * k;
      if (f.life <= 0) { f.light.visible = false; f.light.intensity = 0; }
    }
  }

  billboardRings(camQuat) {
    for (const r of this.rings) if (r.life > 0 && r.billboard) r.mesh.quaternion.copy(camQuat);
  }
}
