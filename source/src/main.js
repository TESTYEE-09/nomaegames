import * as THREE from 'three';
import { Arena } from './arena.js';
import { FX } from './fx.js';
import { Player } from './player.js';
import { WEAPONS, ViewModel } from './weapons.js';
import { Enemy, ENEMY_TYPES, ProjectilePool } from './enemies.js';
import { UI } from './ui.js';
import { AudioEngine } from './audio.js';
import { rollUpgrades } from './upgrades.js';
import { rayWorld, raySphere } from './physics.js';

// ---------------------------------------------------------------- setup
const canvas = document.createElement('canvas');
document.body.insertBefore(canvas, document.body.firstChild);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.autoClear = false;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x070a18, 0.0165);
scene.background = new THREE.Color(0x05060f);

const camera = new THREE.PerspectiveCamera(84, innerWidth / innerHeight, 0.05, 400);

// Sky dome + stars
{
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x120a2e) }, bot: { value: new THREE.Color(0x03040c) }, hot: { value: new THREE.Color(0x2a1050) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bot; uniform vec3 hot;
        void main(){ float h = normalize(vP).y*0.5+0.5;
          vec3 c = mix(bot, top, smoothstep(0.42,0.95,h));
          c += hot * pow(max(0.0,1.0-abs(h-0.5)*3.4), 3.0) * 0.55;
          gl_FragColor = vec4(c,1.0); }`,
    })
  );
  scene.add(sky);
  const N = 900;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.9 + 0.02);
    const r = 165;
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.abs(Math.cos(ph)) * r * 0.8 + 12;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.75, fog: false }));
  scene.add(stars);
}

// A tiny emissive "room" baked into an environment map so metals actually
// reflect something instead of rendering black.
function buildEnvironment() {
  const s = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.deleteAttribute('uv');
  const add = (color, intensity, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.BackSide }));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    s.add(m);
  };
  add(0x0a0f1e, 1, 30, 18, 30, 0, 6, 0);              // shell
  const panel = (color, intensity, sx, sy, sz, x, y, z) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    s.add(m);
  };
  panel(0xbfd8ff, 3.2, 14, 0.4, 14, 0, 13.5, 0);       // ceiling glow
  panel(0x2ee6ff, 2.4, 0.4, 8, 16, -12, 6, 0);         // cyan wall
  panel(0xff2e88, 2.0, 0.4, 8, 16, 12, 6, 0);          // magenta wall
  panel(0xffb14d, 1.2, 16, 6, 0.4, 0, 5, -13);         // amber back
  panel(0x101828, 1.0, 30, 0.4, 30, 0, -1, 0);         // floor
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.03).texture;
  pmrem.dispose();
  return tex;
}
const envMap = buildEnvironment();
scene.environment = envMap;
scene.environmentIntensity = 0.55;

const arena = new Arena(scene, 7);
const fx = new FX(scene);
const player = new Player(arena);
const viewmodel = new ViewModel();
viewmodel.scene.environment = envMap;
viewmodel.scene.environmentIntensity = 1.1;
const projectiles = new ProjectilePool(scene);
const ui = new UI();
const audio = new AudioEngine();

// ---------------------------------------------------------------- state
const S = {
  mode: 'start',       // start | play | upgrade | pause | dead
  time: 0,
  timeScale: 1,
  targetScale: 1,
  wave: 0,
  waveTotal: 0,
  budget: 0,
  spawnTimer: 0,
  betweenT: 0,
  score: 0,
  combo: 0,
  comboT: 0,
  kills: 0,
  shots: 0,
  hits: 0,
  heads: 0,
  best: Number(localStorage.getItem('nb_best') || 0),
  bestWave: Number(localStorage.getItem('nb_bestwave') || 0),
  runTime: 0,
  taken: {},
  trauma: 0,
  fovKick: 0,
  dip: 0,
  tilt: 0,
  muted: false,
};

const enemies = [];
const pickups = [];

const COMBO_WINDOW = 3.6;
const comboMul = () => 1 + Math.min(3.0, S.combo * 0.1);

// ---------------------------------------------------------------- input
const input = {
  fwd: false, back: false, left: false, right: false,
  jumpHeld: false, jumpPressed: false, sprint: false,
  dashPressed: false, fire: false, firePressed: false,
  mdx: 0, mdy: 0,
};
let locked = false;
let sensitivity = 0.0021;

const KEYMAP = {
  KeyW: 'fwd', KeyS: 'back', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'fwd', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
};

addEventListener('keydown', e => {
  if (e.repeat) { if (e.code === 'Space') e.preventDefault(); return; }
  const k = KEYMAP[e.code];
  if (k) { input[k] = true; e.preventDefault(); }
  switch (e.code) {
    case 'Space': input.jumpHeld = true; input.jumpPressed = true; e.preventDefault(); break;
    case 'ShiftLeft': case 'ShiftRight': input.dashPressed = true; break;
    case 'ControlLeft': case 'ControlRight': input.sprint = true; break;
    case 'KeyR': tryReload(); break;
    case 'KeyQ': cycleWeapon(1); break;
    case 'Digit1': selectWeapon(0); break;
    case 'Digit2': selectWeapon(1); break;
    case 'Digit3': selectWeapon(2); break;
    case 'KeyM': S.muted = !S.muted; audio.setMuted(S.muted); ui.toast(S.muted ? 'AUDIO MUTED' : 'AUDIO ON'); break;
    case 'KeyP': case 'Escape': if (S.mode === 'play') pauseGame(); break;
  }
  if (S.mode === 'upgrade') {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
    if (i >= 0) {
      const card = ui.el.cards.children[i];
      if (card) card.click();
    }
  }
});

addEventListener('keyup', e => {
  const k = KEYMAP[e.code];
  if (k) input[k] = false;
  switch (e.code) {
    case 'Space': input.jumpHeld = false; break;
    case 'ControlLeft': case 'ControlRight': input.sprint = false; break;
  }
});

addEventListener('mousedown', e => {
  if (!locked) return;
  if (e.button === 0) { input.fire = true; input.firePressed = true; }
  if (e.button === 2) { /* reserved */ }
});
addEventListener('mouseup', e => { if (e.button === 0) input.fire = false; });
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (locked) cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });

addEventListener('mousemove', e => {
  if (!locked) return;
  input.mdx += e.movementX || 0;
  input.mdy += e.movementY || 0;
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && S.mode === 'play') pauseGame();
});

function requestLock() {
  const p = canvas.requestPointerLock({ unadjustedMovement: true });
  if (p && p.catch) p.catch(() => canvas.requestPointerLock());
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- weapons
function selectWeapon(i) {
  if (S.mode !== 'play') return;
  if (i === player.weaponIndex || !player.unlocked[i]) return;
  player.weaponIndex = i;
  player.reloading = false;
  player.reloadT = 0;
  player.chargeT = 0;
  player.fireT = Math.max(player.fireT, 0.28);
  viewmodel.setWeapon(WEAPONS[i].id);
  viewmodel.setFlashColor(WEAPONS[i].muzzle);
  audio.ui(true);
}

function cycleWeapon(dir) {
  if (S.mode !== 'play') return;
  const n = WEAPONS.length;
  for (let s = 1; s <= n; s++) {
    const i = (player.weaponIndex + dir * s + n * 4) % n;
    if (player.unlocked[i]) { selectWeapon(i); return; }
  }
}

function tryReload() {
  if (S.mode !== 'play' || player.reloading) return;
  const mag = player.magSize;
  if (player.ammo[player.weaponIndex] >= mag) return;
  player.reloading = true;
  player.reloadT = player.weapon.reload * player.stats.reloadMul;
  player.reloadDur = player.reloadT;
  viewmodel.startReload(player.reloadT);
  audio.reload(0);
  setTimeout(() => { if (player.reloading) audio.reload(1); }, player.reloadT * 620);
}

const _eye = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();
const _proj = new THREE.Vector3();

function screenOf(v) {
  _proj.copy(v).project(camera);
  return {
    x: (_proj.x * 0.5 + 0.5) * innerWidth,
    y: (-_proj.y * 0.5 + 0.5) * innerHeight,
    behind: _proj.z > 1,
  };
}

function fireWeapon() {
  const w = player.weapon;
  const i = player.weaponIndex;
  if (player.reloading || player.fireT > 0) return;
  if (player.ammo[i] <= 0) {
    audio.empty();
    player.fireT = 0.25;
    tryReload();
    return;
  }

  player.ammo[i]--;
  player.fireT = w.delay / player.stats.fireRateMul;
  S.shots++;

  player.eyePos(_eye);
  player.forward(_fwd);
  const spread = player.currentSpread();

  audio.shoot(w.sound);
  viewmodel.fire(w.recoil);
  viewmodel.setFlashColor(w.muzzle);
  S.trauma = Math.min(1.2, S.trauma + w.shake);
  player.recoilV += w.recoil.v * (0.75 + Math.random() * 0.5);
  player.recoilH += (Math.random() - 0.5) * w.recoil.h * 2;
  player.pitch += w.recoil.v * 0.0045;
  player.yaw += (Math.random() - 0.5) * w.recoil.h * 0.004;
  player.spreadHeat = Math.min(w.spreadMax, player.spreadHeat + w.spreadGrow);
  S.fovKick = Math.min(1, S.fovKick + w.recoil.kick * 1.6);

  // muzzle world position (roughly along the view ray)
  const muzzle = _tmp.copy(_eye).addScaledVector(_fwd, 0.7);
  muzzle.y -= 0.12;
  fx.flash(muzzle, w.muzzle, 26, 0.08, 12);
  fx.burst(muzzle, w.id === 'scatter' ? 16 : 7, {
    speed: w.id === 'scatter' ? 9 : 5, life: 0.2, size: 0.15, grav: -2,
    dir: { x: _fwd.x, y: _fwd.y, z: _fwd.z }, spread: 0.35,
    color: hexRGB(w.muzzle),
  });

  let anyHit = false, anyCrit = false, anyKill = false;

  for (let p = 0; p < w.pellets; p++) {
    const dir = _tmp2.copy(_fwd);
    if (spread > 0) {
      const a = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * spread * (w.pellets > 1 ? 1 : 1);
      dir.x += Math.cos(a) * rad; dir.y += Math.sin(a) * rad;
      dir.z += (Math.random() - 0.5) * rad * 0.4;
      dir.normalize();
    }
    const r = shootRay(_eye, dir, w);
    if (r.hit) anyHit = true;
    if (r.crit) anyCrit = true;
    if (r.kill) anyKill = true;
  }

  if (anyHit) {
    S.hits++;
    ui.hitmarker(anyKill ? 'kill' : anyCrit ? 'crit' : '');
    audio.hit(anyCrit);
  }
}

function hexRGB(h) { return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }

function shootRay(origin, dir, w) {
  const worldT = rayWorld(origin, dir, arena.boxes, w.range);
  const hits = [];
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0.4) continue;
    const tb = raySphere(origin, dir, e.p, e.r);
    let t = tb, head = false;
    const hc = e.headCenter(_hitPoint);
    const th = raySphere(origin, dir, hc, e.headRadius);
    if (th < t) { t = th; head = true; }
    if (t < worldT && t < w.range) hits.push({ e, t, head });
  }
  hits.sort((a, b) => a.t - b.t);

  const maxTargets = 1 + w.pierce;
  const result = { hit: false, crit: false, kill: false };
  let endT = Math.min(worldT, w.range);

  for (let i = 0; i < hits.length && i < maxTargets; i++) {
    const { e, t, head } = hits[i];
    result.hit = true;
    endT = w.pierce > 0 ? endT : t;

    let dmg = w.damage * player.stats.damageMul;
    const crit = Math.random() < player.stats.critChance;
    if (crit) dmg *= player.stats.critMul;
    if (head) dmg *= player.stats.headshotMul;
    const applied = e.damage(dmg);
    e.knock.addScaledVector(dir, Math.min(9, applied * 0.05) / (e.T.cost * 0.5));

    const point = _tmp.copy(origin).addScaledVector(dir, t);
    const col = hexRGB(e.T.color);
    fx.burst(point, head ? 14 : 8, { speed: 7, life: 0.35, size: 0.15, color: col, grav: -6, dir: { x: -dir.x, y: -dir.y, z: -dir.z }, spread: 0.7 });
    fx.tracer(_tmp2.copy(origin).addScaledVector(dir, 0.6), point, w.tracer, w.tracerW, 0.08);

    const sp = screenOf(point);
    if (!sp.behind) {
      ui.float(sp.x, sp.y, Math.round(applied), head ? 'head' : crit ? 'crit' : '');
    }
    if (head) { S.heads++; result.crit = true; }
    if (crit) result.crit = true;

    if (e.hp <= 0 && !e.dead) { killEnemy(e, dir); result.kill = true; }
  }

  // tracer to world if nothing absorbed it
  if (!result.hit || w.pierce > 0) {
    const end = _tmp.copy(origin).addScaledVector(dir, Math.min(endT, w.range));
    fx.tracer(_tmp2.copy(origin).addScaledVector(dir, 0.6), end, w.tracer, w.tracerW, w.id === 'rail' ? 0.22 : 0.07);
    if (worldT < w.range) {
      const hp = _tmp.copy(origin).addScaledVector(dir, worldT);
      const n = _tmp2.copy(dir).multiplyScalar(-1);
      fx.burst(hp, 7, { speed: 6, life: 0.32, size: 0.11, color: [1, 0.85, 0.55], grav: -12, dir: n, spread: 0.9 });
      fx.decal(hp, n, w.muzzle, 0.45 + Math.random() * 0.25, 2.2);
      fx.flash(hp, 0xffd9a0, 5, 0.08, 5);
    }
  }
  return result;
}

// ---------------------------------------------------------------- kills
function killEnemy(e, dir) {
  if (e.dead) return;
  e.dead = true;
  S.kills++;
  S.combo++;
  S.comboT = COMBO_WINDOW;
  const gain = Math.round(e.T.score * comboMul());
  S.score += gain;

  const col = hexRGB(e.T.color);
  fx.shardBurst(e.p, e.T.shards, col, { speed: 9, size: e.r * 0.42, life: 1.7, up: 4 });
  fx.burst(e.p, 34, { speed: 11, life: 0.6, size: 0.24, color: col, grav: -9 });
  fx.ring(e.p, { color: e.T.color, from: 0.3, to: e.r * 5.5, life: 0.5, billboard: true });
  fx.flash(e.p, e.T.color, 60, 0.28, 16);
  audio.kill();
  S.trauma = Math.min(1.4, S.trauma + 0.14 + e.T.cost * 0.02);

  const sp = screenOf(_tmp.copy(e.p).add(_tmp2.set(0, 0.6, 0)));
  if (!sp.behind) ui.float(sp.x, sp.y - 24, '+' + gain, 'crit');
  ui.feedKill(`${e.T.id.toUpperCase()} TERMINATED  +${gain}`, '#' + e.T.color.toString(16).padStart(6, '0'));

  if (player.stats.lifesteal > 0 && player.hp < player.stats.maxHp) {
    player.heal(player.stats.lifesteal);
    ui.flashHeal();
  }

  // detonation core
  if (player.stats.explosive > 0) {
    const dmg = 40 + (player.stats.explosive - 1) * 30;
    const R = 5.5 + player.stats.explosive * 0.7;
    fx.ring(e.p, { color: 0xffb14d, from: 0.4, to: R * 1.6, life: 0.45, billboard: true });
    fx.burst(e.p, 26, { speed: 14, life: 0.5, size: 0.28, color: [1, 0.62, 0.2], grav: -6 });
    fx.flash(e.p, 0xffb14d, 90, 0.3, 22);
    audio.explode();
    S.trauma = Math.min(1.5, S.trauma + 0.25);
    for (const o of enemies) {
      if (o === e || o.dead) continue;
      const d = o.p.distanceTo(e.p);
      if (d < R) {
        const a = o.damage(dmg * (1 - d / R * 0.5));
        const sp2 = screenOf(o.p);
        if (!sp2.behind) ui.float(sp2.x, sp2.y, Math.round(a), '');
        if (o.hp <= 0) killEnemy(o, dir);
      }
    }
  }

  // drops
  if (Math.random() < e.T.xpDrop) spawnPickup(e.p, 'health');

  // slow-mo for chunky kills / multikills
  if (e.T.cost >= 5) slowmo(0.32, 0.55);
  else if (S.combo > 0 && S.combo % 12 === 0) { slowmo(0.4, 0.4); ui.banner('', S.combo + ' STREAK', 'COMBO ×' + comboMul().toFixed(1), 1.5, '#ffb14d'); audio.levelUp(); }
}

function slowmo(scale, dur) {
  S.targetScale = scale;
  clearTimeout(S._slowT);
  S._slowT = setTimeout(() => { S.targetScale = 1; }, dur * 1000);
}

// ---------------------------------------------------------------- pickups
function spawnPickup(pos, kind) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.3, 0),
    new THREE.MeshBasicMaterial({ color: kind === 'health' ? 0x6effa0 : 0x2ee6ff })
  );
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 12, 10),
    new THREE.MeshBasicMaterial({ color: kind === 'health' ? 0x6effa0 : 0x2ee6ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  g.add(core); g.add(halo);
  g.position.copy(pos);
  const light = new THREE.PointLight(0x6effa0, 8, 6, 2);
  g.add(light);
  scene.add(g);
  pickups.push({ mesh: g, core, p: g.position, life: 22, kind, phase: Math.random() * 6 });
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pk = pickups[i];
    pk.life -= dt;
    pk.core.rotation.y += dt * 2.4;
    pk.core.rotation.x += dt * 1.5;
    const gh = arena.groundHeight(pk.p.x, pk.p.z);
    const restY = gh + 0.8 + Math.sin(S.time * 2.4 + pk.phase) * 0.16;
    pk.p.y += (restY - pk.p.y) * Math.min(1, dt * 4);

    const d = pk.p.distanceTo(_tmp.set(player.pos.x, player.pos.y + 0.9, player.pos.z));
    if (d < player.stats.pickupRange + 1.5) {
      pk.p.lerp(_tmp, Math.min(1, dt * (5 + (player.stats.pickupRange + 1.5 - d))));
    }
    if (d < 1.1) {
      player.heal(28);
      ui.flashHeal();
      audio.pickup();
      fx.burst(pk.p, 16, { speed: 6, life: 0.4, size: 0.16, color: [0.43, 1, 0.63], grav: -3 });
      const sp = screenOf(pk.p);
      if (!sp.behind) ui.float(sp.x, sp.y, '+28', 'heal');
      scene.remove(pk.mesh);
      pickups.splice(i, 1);
      continue;
    }
    if (pk.life <= 0) {
      fx.burst(pk.p, 8, { speed: 4, life: 0.3, size: 0.12, color: [0.43, 1, 0.63], grav: 0 });
      scene.remove(pk.mesh);
      pickups.splice(i, 1);
    } else if (pk.life < 4) {
      pk.mesh.visible = Math.sin(pk.life * 18) > -0.3;
    }
  }
}

// ---------------------------------------------------------------- waves
function waveComposition(n) {
  const pool = [];
  pool.push('seeker');
  if (n >= 2) pool.push('spitter');
  if (n >= 4) pool.push('wisp');
  if (n >= 5) pool.push('brute');
  return pool;
}

function startWave(n) {
  S.wave = n;
  S.budget = Math.round(6 + n * 3.1 + Math.pow(n, 1.45));
  S.waveTotal = 0;
  S.spawnTimer = 1.0;
  S.hpScale = 1 + (n - 1) * 0.13;
  S.speedScale = Math.min(1.45, 1 + (n - 1) * 0.028);
  S.maxAlive = Math.min(30, 6 + Math.floor(n * 1.6));
  S.waveKills = 0;
  // estimate total for the progress bar
  const pool = waveComposition(n);
  const avg = pool.reduce((a, id) => a + ENEMY_TYPES[id].cost, 0) / pool.length;
  S.waveTotal = Math.max(1, Math.round(S.budget / avg));
  S.waveDone = false;

  ui.banner('INCOMING', 'WAVE ' + String(n).padStart(2, '0'),
    n % 5 === 0 ? '⚠ HEAVY RESISTANCE' : 'BREACH DETECTED', 2.2, n % 5 === 0 ? '#ffb14d' : '#ff2e88');
  audio.waveStart(n);
  audio.setIntensity(Math.min(1, 0.15 + n * 0.09));

  // weapon unlocks
  if (n === 3 && !player.unlocked[1]) unlockWeapon(1);
  if (n === 6 && !player.unlocked[2]) unlockWeapon(2);
}

function unlockWeapon(i) {
  player.unlocked[i] = true;
  player.ammo[i] = Math.round(WEAPONS[i].mag * player.stats.magMul);
  ui.banner('WEAPON ONLINE', WEAPONS[i].name, 'PRESS ' + (i + 1) + ' TO EQUIP', 2.6, '#2ee6ff');
  audio.levelUp();
}

function pickSpawn() {
  let best = null, bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const c = arena.spawnPoints[Math.floor(Math.random() * arena.spawnPoints.length)];
    const d = c.distanceTo(player.pos);
    if (d < 14) continue;
    const score = -Math.abs(d - 24) + Math.random() * 6;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best || arena.spawnPoints[0];
}

function spawnEnemy(typeId, at) {
  const e = new Enemy(typeId, scene, S.hpScale, S.speedScale);
  e.spawnAt(at);
  enemies.push(e);
  fx.ring(_tmp.copy(at).setY(at.y + 0.05), { color: ENEMY_TYPES[typeId].color, from: 0.3, to: 3.4, life: 0.6 });
  fx.burst(_tmp.copy(at).setY(at.y + 0.8), 24, {
    speed: 5, life: 0.6, size: 0.2, color: hexRGB(ENEMY_TYPES[typeId].color),
    dir: { x: 0, y: 1, z: 0 }, spread: 0.55, grav: -2,
  });
  fx.flash(_tmp.copy(at).setY(at.y + 1), ENEMY_TYPES[typeId].color, 40, 0.4, 14);
  audio.spawnPortal();
}

function updateWave(dt) {
  const alive = enemies.length;
  if (S.budget > 0) {
    S.spawnTimer -= dt;
    if (S.spawnTimer <= 0 && alive < S.maxAlive) {
      const pool = waveComposition(S.wave).filter(id => ENEMY_TYPES[id].cost <= S.budget);
      if (pool.length) {
        // Weight toward the cheaper units so waves feel like swarms with elites.
        const weights = pool.map(id => 1 / ENEMY_TYPES[id].cost);
        let tot = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * tot, pick = pool[0];
        for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) { pick = pool[i]; break; } }
        spawnEnemy(pick, pickSpawn());
        S.budget -= ENEMY_TYPES[pick].cost;
        S.spawnTimer = Math.max(0.22, 0.95 - S.wave * 0.035) * (0.6 + Math.random() * 0.8);
      } else S.budget = 0;
    }
  } else if (alive === 0 && !S.waveDone) {
    S.waveDone = true;
    S.betweenT = 1.5;
    slowmo(0.35, 1.0);
    ui.banner('SECTOR CLEAR', 'WAVE ' + String(S.wave).padStart(2, '0'), 'AUGMENT AVAILABLE', 2.0, '#6effa0');
    audio.levelUp();
  }

  if (S.waveDone) {
    S.betweenT -= dt;
    if (S.betweenT <= 0) openUpgrades();
  }

  const remaining = Math.max(0, alive + Math.ceil(S.budget / 2));
  ui.setWave(S.wave, remaining, S.waveTotal);
}

// ---------------------------------------------------------------- flow
function openUpgrades() {
  S.mode = 'upgrade';
  S.targetScale = 1;
  S.timeScale = 1;
  document.exitPointerLock();
  const list = rollUpgrades(player, S.taken, 3);
  ui.el.upgtitle.textContent = 'SELECT AUGMENT';
  ui.showUpgrades(list, (u) => {
    S.taken[u.id] = (S.taken[u.id] || 0) + 1;
    u.apply(player);
    player.hp = Math.min(player.hp, player.stats.maxHp);
    audio.levelUp();
    ui.hide('upgrade');
    ui.toast(u.name + ' INSTALLED');
    resumeToPlay();
    startWave(S.wave + 1);
  });
}

function resumeToPlay() {
  S.mode = 'play';
  requestLock();
}

function pauseGame() {
  if (S.mode !== 'play') return;
  S.mode = 'pause';
  input.fire = false;
  ui.show('pause');
  document.exitPointerLock();
}

function unpause() {
  if (S.mode !== 'pause') return;
  ui.hide('pause');
  S.mode = 'play';
  requestLock();
}

function startGame() {
  ui.hide('start'); ui.hide('gameover'); ui.hide('pause'); ui.hide('upgrade');
  for (const e of enemies) e.dispose(scene);
  enemies.length = 0;
  for (const p of pickups) scene.remove(p.mesh);
  pickups.length = 0;
  projectiles.clear();
  S.score = 0; S.combo = 0; S.comboT = 0; S.kills = 0; S.shots = 0; S.hits = 0; S.heads = 0;
  S.taken = {}; S.runTime = 0; S.trauma = 0;
  S.timeScale = 1; S.targetScale = 1;
  player.stats.maxHp = 100; player.stats.speed = 8.2; player.stats.damageMul = 1;
  player.stats.fireRateMul = 1; player.stats.reloadMul = 1; player.stats.magMul = 1;
  player.stats.critChance = 0.05; player.stats.critMul = 2.0; player.stats.headshotMul = 2.0;
  player.stats.lifesteal = 0; player.stats.explosive = 0; player.stats.shieldMax = 0;
  player.stats.jumps = 2; player.stats.dashMax = 2; player.stats.regenHealth = 0;
  player.reset();
  viewmodel.setWeapon('pulse');
  viewmodel.setFlashColor(WEAPONS[0].muzzle);
  ui.dispScore = 0; ui.targetScore = 0; ui.el.scorenum.textContent = '0';
  ui.el.feed.innerHTML = '';
  S.mode = 'play';
  audio.init();
  audio.resume();
  audio.setMusic(true);
  audio.setIntensity(0.2);
  requestLock();
  startWave(1);
}

function gameOver() {
  if (S.mode === 'dead') return;
  S.mode = 'dead';
  S.targetScale = 1;
  document.exitPointerLock();
  audio.gameOver();
  audio.setIntensity(0);
  S.trauma = 1.2;
  fx.burst(_tmp.copy(player.pos).setY(player.pos.y + 1), 60, { speed: 12, life: 0.9, size: 0.3, color: [1, 0.2, 0.35], grav: -8 });

  const isBest = S.score > S.best;
  if (isBest) { S.best = S.score; localStorage.setItem('nb_best', String(S.best)); }
  if (S.wave > S.bestWave) { S.bestWave = S.wave; localStorage.setItem('nb_bestwave', String(S.bestWave)); }
  const acc = S.shots ? Math.round(S.hits / S.shots * 100) : 0;
  const mins = Math.floor(S.runTime / 60), secs = Math.floor(S.runTime % 60);
  setTimeout(() => {
    ui.showGameOver([
      ['SCORE', S.score.toLocaleString(), true],
      ['WAVE REACHED', S.wave],
      ['TERMINATIONS', S.kills],
      ['ACCURACY', acc + '%'],
      ['CRITICAL HITS', S.heads],
      ['TIME SURVIVED', `${mins}:${String(secs).padStart(2, '0')}`],
      ['PERSONAL BEST', S.best.toLocaleString() + (isBest ? '  ★NEW' : '')],
    ]);
  }, 900);
}

player.onDeath = gameOver;
player.onDamage = (amount, from) => {
  ui.flashDamage();
  audio.hurt();
  S.trauma = Math.min(1.5, S.trauma + 0.25 + amount * 0.006);
  if (from) {
    const dx = from.x - player.pos.x, dz = from.z - player.pos.z;
    const ang = Math.atan2(dx, -dz) - player.yaw;
    ui.damageDir(-ang);
  }
};

$('startbtn').onclick = () => { audio.init(); audio.resume(); startGame(); };
$('retrybtn').onclick = () => startGame();
$('resumebtn').onclick = () => unpause();
$('skipmenu').onclick = () => { ui.hide('pause'); S.mode = 'start'; ui.show('start'); audio.setIntensity(0); };
document.querySelectorAll('.slot').forEach(s => { s.style.pointerEvents = 'auto'; s.onclick = () => selectWeapon(+s.dataset.i); });
function $(id) { return document.getElementById(id); }

// ---------------------------------------------------------------- camera
const camShake = { x: 0, y: 0, r: 0 };
function updateCamera(dt) {
  player.eyePos(_eye);

  // trauma-driven shake
  S.trauma = Math.max(0, S.trauma - dt * 1.9);
  const tr = S.trauma * S.trauma;
  const t = S.time * 42;
  camShake.x = (Math.sin(t * 1.7) + Math.sin(t * 0.53)) * 0.5 * tr * 0.16;
  camShake.y = (Math.cos(t * 1.3) + Math.sin(t * 0.91)) * 0.5 * tr * 0.16;
  camShake.r = Math.sin(t * 0.77) * tr * 0.035;

  // landing dip + step bob
  S.dip += (player.landImpact * 0.35 - S.dip) * Math.min(1, dt * 14);
  const bobK = player.moveAmt * (player.speedNow / player.stats.speed);
  const bobY = Math.sin(viewmodel.bob * 2) * 0.035 * bobK;
  const bobX = Math.cos(viewmodel.bob) * 0.03 * bobK;

  // strafe tilt
  const rightVel = player.vel.x * Math.cos(player.yaw) - player.vel.z * Math.sin(player.yaw);
  S.tilt += ((-rightVel / player.stats.speed) * 0.028 - S.tilt) * Math.min(1, dt * 8);

  camera.position.set(
    _eye.x + camShake.x + bobX,
    _eye.y + camShake.y + bobY - S.dip,
    _eye.z
  );
  camera.rotation.set(0, 0, 0, 'YXZ');
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw + player.recoilH * 0.0012 + camShake.x * 0.1;
  camera.rotation.x = player.pitch + player.recoilV * 0.0022 + camShake.y * 0.1;
  camera.rotation.z = S.tilt + camShake.r + (player.dashT > 0 ? 0.05 : 0);

  // FOV
  S.fovKick = Math.max(0, S.fovKick - dt * 5.5);
  const sprintK = (input.sprint && player.speedNow > 6 ? 1 : 0) * 0.6 + Math.min(1, player.speedNow / 26) * 0.5;
  const targetFov = 84 + sprintK * 8 + S.fovKick * 4 + (player.dashT > 0 ? 12 : 0);
  camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 9);
  camera.updateProjectionMatrix();

  ui.setSpeedLines(Math.max(0, Math.min(0.9, (player.speedNow - 11) / 16)));
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let fpsAcc = 0, fpsN = 0, fpsT = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let raw = (now - last) / 1000;
  last = now;
  if (raw > 0.1) raw = 0.1;

  S.timeScale += (S.targetScale - S.timeScale) * Math.min(1, raw * (S.targetScale < S.timeScale ? 22 : 5));
  const dt = raw * (S.mode === 'play' ? S.timeScale : (S.mode === 'dead' ? 0.25 : 0));
  S.time += dt;

  // look (applied even at dt 0 so aiming stays 1:1)
  if (S.mode === 'play' && locked) {
    player.look(input.mdx, input.mdy, sensitivity);
  }
  const lookDX = input.mdx * sensitivity, lookDY = input.mdy * sensitivity;
  input.mdx = 0; input.mdy = 0;

  if (S.mode === 'play') {
    S.runTime += raw;

    player.update(dt, input, arena.boxes, audio, fx);

    // reload progress
    if (player.reloading) {
      player.reloadT -= dt;
      if (player.reloadT <= 0) {
        player.reloading = false;
        player.ammo[player.weaponIndex] = player.magSize;
        player.spreadHeat = 0;
      }
    }

    // firing
    const w = player.weapon;
    if (w.charge) {
      const canCharge = input.fire && !player.reloading && player.fireT <= 0;
      if (canCharge && player.ammo[player.weaponIndex] <= 0) {
        if (input.firePressed) { audio.empty(); tryReload(); }
      } else if (canCharge) {
        if (player.chargeT === 0) audio.charge(w.charge);
        player.chargeT = Math.min(w.charge, player.chargeT + dt);
        if (player.chargeT >= w.charge) { player.chargeT = 0; fireWeapon(); }
      } else if (!input.fire) {
        player.chargeT = Math.max(0, player.chargeT - dt * 2.5);
      }
    } else if ((w.auto && input.fire) || (!w.auto && input.firePressed)) {
      fireWeapon();
    }

    // combo decay
    if (S.combo > 0) {
      S.comboT -= dt;
      if (S.comboT <= 0) { S.combo = 0; }
    }

    // enemies
    const ctx = { player, boxes: arena.boxes, fx, audio, projectiles, time: S.time };
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.dead) { e.dispose(scene); enemies.splice(i, 1); continue; }
      e.update(dt, ctx);
    }
    // enemy separation so they don't stack into one blob
    for (let i = 0; i < enemies.length; i++) {
      for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j];
        const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) / d * 0.5;
        const mA = b.T.cost / (a.T.cost + b.T.cost);
        a.p.x -= dx * push * 2 * mA; a.p.z -= dz * push * 2 * mA;
        b.p.x += dx * push * 2 * (1 - mA); b.p.z += dz * push * 2 * (1 - mA);
      }
    }

    projectiles.update(dt, ctx);
    updatePickups(dt);
    updateWave(dt);
    arena.update(dt, S.time);

    // HUD
    const spreadPx = player.currentSpread() * innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360)) * 0.9;
    let hot = false;
    player.eyePos(_eye); player.forward(_fwd);
    for (const e of enemies) {
      if (e.dead) continue;
      if (raySphere(_eye, _fwd, e.p, e.r) < 200) { hot = true; break; }
    }
    ui.setCrosshair(Math.min(60, spreadPx), hot);
    ui.setHealth(player.hp, player.stats.maxHp, player.shield, player.stats.shieldMax);
    ui.setAmmo(w.name, player.ammo[player.weaponIndex], player.magSize,
      player.reloading ? 1 - player.reloadT / player.reloadDur : (w.charge ? player.chargeT / w.charge : 0),
      player.weaponIndex, player.unlocked, '#' + w.color.toString(16).padStart(6, '0'));
    ui.setDash(player.dashCharges, player.stats.dashMax);
    ui.setScore(S.score, comboMul(), Math.max(0, S.comboT / COMBO_WINDOW));

    audio.setIntensity(Math.min(1, 0.15 + S.wave * 0.08 + Math.min(0.3, enemies.length * 0.02)));
  } else if (S.mode === 'dead') {
    for (const e of enemies) if (!e.dead) e.update(dt, { player, boxes: arena.boxes, fx, audio, projectiles, time: S.time });
    arena.update(dt, S.time);
  }

  input.jumpPressed = false;
  input.dashPressed = false;
  input.firePressed = false;

  fx.update(raw * (S.mode === 'play' || S.mode === 'dead' ? Math.max(0.15, S.timeScale) : 0.15));
  viewmodel.update(raw, {
    moveAmt: player.moveAmt, grounded: player.grounded,
    lookDX, lookDY, speed: Math.min(14, player.speedNow),
    charge: player.weapon.charge ? player.chargeT / player.weapon.charge : 0,
  });
  ui.update(raw);
  updateCamera(raw);
  fx.billboardRings(camera.quaternion);

  // fps meter
  fpsAcc += 1 / Math.max(0.0001, raw); fpsN++; fpsT += raw;
  if (fpsT > 0.5) { ui.el.fps.textContent = Math.round(fpsAcc / fpsN) + ' FPS'; fpsAcc = 0; fpsN = 0; fpsT = 0; }

  renderer.clear();
  renderer.render(scene, camera);
  viewmodel.render(renderer, innerWidth / innerHeight);
}

// Debug handle (harmless in play, invaluable when tuning).
window.NB = {
  S, player, enemies, arena, fx, audio, ui, camera, scene, renderer,
  spawnEnemy, startWave, pickups, viewmodel, input,
  // Step the simulation by hand (the render loop is rAF-driven and pauses
  // when the tab is not painting, which makes headless inspection useless).
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) frame(last + dt * 1000); },
};

// idle camera orbit on the title screen
player.pos.set(0, 0, 24);
requestAnimationFrame(frame);

// Slowly pan the camera while sitting on the menu.
setInterval(() => {
  if (S.mode === 'start' || S.mode === 'dead') {
    player.yaw += 0.0025;
    player.pitch = -0.08 + Math.sin(performance.now() * 0.0004) * 0.05;
  }
}, 16);
