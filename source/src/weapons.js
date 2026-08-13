import * as THREE from 'three';

export const WEAPONS = [
  {
    id: 'pulse', name: 'PULSE RIFLE', auto: true,
    damage: 15, delay: 0.082, mag: 32, reload: 1.35,
    pellets: 1, spread: 0.008, spreadMove: 0.02, spreadAir: 0.03, spreadGrow: 0.0032, spreadMax: 0.045,
    recoil: { v: 0.9, h: 0.35, kick: 0.055, roll: 0.02 },
    range: 200, pierce: 0, tracer: 0x9ff6ff, tracerW: 0.028, muzzle: 0x9ff6ff,
    shake: 0.10, sound: 'pulse', color: 0x2ee6ff,
  },
  {
    id: 'scatter', name: 'SCATTERGUN', auto: false,
    damage: 13, delay: 0.62, mag: 7, reload: 1.9,
    pellets: 10, spread: 0.052, spreadMove: 0.012, spreadAir: 0.02, spreadGrow: 0, spreadMax: 0.09,
    recoil: { v: 3.4, h: 0.7, kick: 0.22, roll: 0.09 },
    range: 60, pierce: 1, tracer: 0xffc25e, tracerW: 0.02, muzzle: 0xffb14d,
    shake: 0.42, sound: 'scatter', color: 0xffb14d,
  },
  {
    id: 'rail', name: 'RAILGUN', auto: false,
    damage: 130, delay: 0.95, mag: 4, reload: 2.1,
    pellets: 1, spread: 0, spreadMove: 0.004, spreadAir: 0.006, spreadGrow: 0, spreadMax: 0.01,
    recoil: { v: 2.6, h: 0.3, kick: 0.3, roll: 0.05 },
    range: 300, pierce: 99, tracer: 0xff5ecb, tracerW: 0.075, muzzle: 0xff5ecb,
    shake: 0.55, sound: 'rail', color: 0xff5ecb, charge: 0.34,
  },
];

const dark = () => new THREE.MeshStandardMaterial({ color: 0x39415f, roughness: 0.38, metalness: 0.75 });
const mid = () => new THREE.MeshStandardMaterial({ color: 0x525c82, roughness: 0.3, metalness: 0.85 });
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c });

function box(parent, w, h, d, x, y, z, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function buildPulse() {
  const g = new THREE.Group();
  const D = dark(), M = mid(), G = glowMat(0x2ee6ff);
  box(g, 0.13, 0.15, 0.72, 0, 0, -0.2, D);           // receiver
  box(g, 0.075, 0.075, 0.62, 0, 0.012, -0.72, M);    // barrel
  box(g, 0.05, 0.05, 0.12, 0, 0.012, -1.06, D);      // muzzle brake
  box(g, 0.1, 0.24, 0.14, 0, -0.17, 0.02, D);        // grip
  box(g, 0.09, 0.2, 0.1, 0, -0.13, -0.32, M);        // mag
  box(g, 0.11, 0.09, 0.3, 0, 0.1, 0.16, D);          // stock
  box(g, 0.04, 0.06, 0.05, 0, 0.115, -0.28, D);      // front sight
  const e1 = box(g, 0.145, 0.03, 0.34, 0, 0.045, -0.28, G);
  const e2 = box(g, 0.03, 0.055, 0.055, 0, -0.13, -0.32, glowMat(0x66f0ff));
  g.rotation.y = 0.02;
  return { group: g, glow: [e1, e2], muzzleAt: new THREE.Vector3(0, 0.012, -1.14) };
}

function buildScatter() {
  const g = new THREE.Group();
  const D = dark(), M = mid(), G = glowMat(0xffb14d);
  box(g, 0.19, 0.16, 0.5, 0, 0, -0.14, D);
  box(g, 0.07, 0.07, 0.78, -0.055, 0.02, -0.68, M);
  box(g, 0.07, 0.07, 0.78, 0.055, 0.02, -0.68, M);
  box(g, 0.2, 0.1, 0.22, 0, -0.06, -0.52, D);        // pump
  box(g, 0.1, 0.26, 0.15, 0, -0.18, 0.04, D);
  box(g, 0.12, 0.12, 0.3, 0, 0.02, 0.22, M);         // stock
  const e1 = box(g, 0.205, 0.028, 0.26, 0, 0.06, -0.16, G);
  const e2 = box(g, 0.03, 0.03, 0.2, 0, -0.04, -0.53, glowMat(0xffd79a));
  return { group: g, glow: [e1, e2], muzzleAt: new THREE.Vector3(0, 0.02, -1.06), pump: g.children[3] };
}

function buildRail() {
  const g = new THREE.Group();
  const D = dark(), M = mid(), G = glowMat(0xff5ecb);
  box(g, 0.14, 0.17, 0.6, 0, 0, -0.1, D);
  box(g, 0.055, 0.055, 1.05, 0, 0.03, -0.86, M);
  box(g, 0.1, 0.26, 0.14, 0, -0.19, 0.06, D);
  box(g, 0.12, 0.1, 0.34, 0, 0.06, 0.24, D);
  const coils = [];
  for (let i = 0; i < 5; i++) {
    const c = box(g, 0.15, 0.15, 0.045, 0, 0.03, -0.52 - i * 0.17, D);
    const ring = box(g, 0.17, 0.026, 0.05, 0, 0.03, -0.52 - i * 0.17, G.clone());
    coils.push(ring); void c;
  }
  const core = box(g, 0.09, 0.09, 0.2, 0, 0.045, -0.16, glowMat(0xff5ecb));
  const e1 = box(g, 0.155, 0.03, 0.3, 0, 0.075, -0.14, G);
  return { group: g, glow: [e1, core, ...coils], coils, core, muzzleAt: new THREE.Vector3(0, 0.03, -1.42) };
}

const BUILDERS = { pulse: buildPulse, scatter: buildScatter, rail: buildRail };

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.01, 12);
    const amb = new THREE.HemisphereLight(0xbfd8ff, 0x151022, 1.4);
    this.scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(-0.6, 1.2, 1.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff4f9f, 1.2);
    rim.position.set(1.4, 0.2, -1);
    this.scene.add(rim);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.models = {};
    for (const w of WEAPONS) {
      const built = BUILDERS[w.id]();
      built.group.visible = false;
      this.root.add(built.group);
      this.models[w.id] = built;
    }

    this.muzzleLight = new THREE.PointLight(0xffffff, 0, 4, 2);
    this.scene.add(this.muzzleLight);
    this.muzzleFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })
    );
    this.scene.add(this.muzzleFlash);
    this.flashT = 0;

    this.root.scale.setScalar(0.55);
    this.current = null;
    this.basePos = new THREE.Vector3(0.29, -0.275, -0.58);
    this.pos = this.basePos.clone();
    this.rot = new THREE.Euler();
    this.recoilPos = 0;
    this.recoilRot = 0;
    this.swayX = 0; this.swayY = 0;
    this.bob = 0;
    this.reloadT = 0; this.reloadDur = 1;
    this.switchT = 0;
    this.ads = 0;
    this.chargeGlow = 0;
    this.t = 0;
  }

  setWeapon(id) {
    for (const k in this.models) this.models[k].group.visible = (k === id);
    this.current = id;
    this.switchT = 1;
  }

  fire(recoil) {
    this.recoilPos = Math.min(0.36, this.recoilPos + recoil.kick);
    this.recoilRot = Math.min(0.6, this.recoilRot + recoil.kick * 1.5);
    this.flashT = 1;
  }

  startReload(dur) { this.reloadT = 1; this.reloadDur = dur; }

  update(dt, opts) {
    this.t += dt;
    const { moveAmt = 0, grounded = true, lookDX = 0, lookDY = 0, speed = 0, charge = 0 } = opts;

    // sway from mouse
    this.swayX += (-lookDX * 0.6 - this.swayX) * Math.min(1, dt * 12);
    this.swayY += (-lookDY * 0.6 - this.swayY) * Math.min(1, dt * 12);
    this.swayX = THREE.MathUtils.clamp(this.swayX, -0.09, 0.09);
    this.swayY = THREE.MathUtils.clamp(this.swayY, -0.09, 0.09);

    // walk bob
    this.bob += dt * speed * 1.25;
    const bobAmt = moveAmt * (grounded ? 1 : 0.25);
    const bx = Math.sin(this.bob) * 0.022 * bobAmt;
    const by = Math.abs(Math.cos(this.bob)) * 0.018 * bobAmt;

    // recoil decay
    this.recoilPos *= Math.pow(0.0009, dt);
    this.recoilRot *= Math.pow(0.0015, dt);

    // reload / switch anims
    if (this.reloadT > 0) this.reloadT = Math.max(0, this.reloadT - dt / this.reloadDur);
    if (this.switchT > 0) this.switchT = Math.max(0, this.switchT - dt * 4.5);

    const rl = this.reloadT > 0 ? Math.sin((1 - this.reloadT) * Math.PI) : 0;
    const sw = this.switchT;

    const m = this.models[this.current];
    if (!m) return;

    this.root.position.set(
      this.basePos.x + this.swayX + bx,
      this.basePos.y + this.swayY + by - rl * 0.22 - sw * 0.4,
      this.basePos.z + this.recoilPos
    );
    this.root.rotation.set(
      this.recoilRot * 0.9 + rl * 0.5 + sw * 0.5,
      this.swayX * 1.4 + rl * 0.35,
      -this.swayY * 0.8 + rl * 0.5 + sw * 0.6
    );

    // muzzle flash
    this.flashT = Math.max(0, this.flashT - dt * 22);
    this.root.updateMatrixWorld();
    const mp = this.root.localToWorld(m.muzzleAt.clone());
    this.muzzleFlash.position.copy(mp);
    this.muzzleFlash.material.opacity = this.flashT * 0.95;
    this.muzzleFlash.scale.setScalar(0.35 + (1 - this.flashT) * 0.5);
    this.muzzleFlash.rotation.z = this.t * 30;
    this.muzzleLight.position.copy(mp);
    this.muzzleLight.intensity = this.flashT * 9;

    // charge glow (railgun)
    this.chargeGlow += (charge - this.chargeGlow) * Math.min(1, dt * 14);
    if (m.coils) {
      for (let i = 0; i < m.coils.length; i++) {
        const k = Math.max(0, Math.min(1, this.chargeGlow * m.coils.length - i));
        m.coils[i].material.color.setRGB(1 * (0.35 + k), 0.37 * (0.4 + k * 0.3), 0.8 * (0.5 + k * 0.6));
        m.coils[i].scale.setScalar(1 + k * 0.25);
      }
      m.core.scale.setScalar(1 + this.chargeGlow * 0.9);
    }
    if (m.pump) m.pump.position.z = -0.52 + rl * 0.16;
  }

  setFlashColor(hex) {
    this.muzzleFlash.material.color.setHex(hex);
    this.muzzleLight.color.setHex(hex);
  }

  render(renderer, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
