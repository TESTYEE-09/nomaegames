import * as THREE from 'three';

// Deterministic-ish RNG so an arena can be re-rolled per run.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gridTexture(size, cells, bg, line, glow) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  const step = size / cells;
  g.lineCap = 'square';
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = pass === 0 ? glow : line;
    g.lineWidth = pass === 0 ? 7 : 2;
    g.globalAlpha = pass === 0 ? 0.35 : 1;
    g.beginPath();
    for (let i = 0; i <= cells; i++) {
      const p = Math.round(i * step) + 0.5;
      g.moveTo(p, 0); g.lineTo(p, size);
      g.moveTo(0, p); g.lineTo(size, p);
    }
    g.stroke();
  }
  g.globalAlpha = 1;
  // Subtle noise speckle for texture at grazing angles.
  for (let i = 0; i < size * 2; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export const ARENA_SIZE = 66; // full width/depth
const H = ARENA_SIZE / 2;

export class Arena {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.boxes = [];        // THREE.Box3 collision volumes
    this.spawnPoints = [];  // Vector3 candidates for enemy spawns
    this.group = new THREE.Group();
    scene.add(this.group);
    this._build(mulberry32(seed));
  }

  _addBox(x, y, z, w, h, d, mat, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = opts.noShadow !== true;
    m.receiveShadow = true;
    this.group.add(m);
    if (opts.collide !== false) {
      this.boxes.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, y, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h, z + d / 2)
      ));
    }
    return m;
  }

  _addTrim(x, y, z, w, d, color) {
    const mat = new THREE.MeshBasicMaterial({ color });
    const geo = new THREE.BoxGeometry(w + 0.08, 0.09, d + 0.08);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  _build(rnd) {
    const scene = this.scene;

    // ---- Floor -------------------------------------------------------
    const floorTex = gridTexture(512, 8, '#0a0a14', '#2ee6ff', '#0d6d8a');
    floorTex.repeat.set(ARENA_SIZE / 8, ARENA_SIZE / 8);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex, roughness: 0.55, metalness: 0.35,
      emissiveMap: floorTex, emissive: new THREE.Color(0x0a3a4a), emissiveIntensity: 0.9,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);
    this.floorMat = floorMat;

    // Reflection-ish sheen plane just under the grid.
    const sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new THREE.MeshBasicMaterial({ color: 0x08111e, transparent: true, opacity: 0.65 })
    );
    sheen.rotation.x = -Math.PI / 2;
    sheen.position.y = -0.02;
    this.group.add(sheen);

    // ---- Materials ---------------------------------------------------
    const wallTex = gridTexture(256, 4, '#0d1020', '#7a3cff', '#3a1a80');
    wallTex.repeat.set(4, 2);
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex, roughness: 0.7, metalness: 0.2,
      emissiveMap: wallTex, emissive: new THREE.Color(0x1a0d3a), emissiveIntensity: 0.8,
    });
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0x2b3352, roughness: 0.55, metalness: 0.55,
      emissive: 0x0a1428, emissiveIntensity: 1,
    });
    const blockMat2 = new THREE.MeshStandardMaterial({
      color: 0x39406a, roughness: 0.42, metalness: 0.7,
      emissive: 0x140a28, emissiveIntensity: 1,
    });
    this.wallMat = wallMat;

    // ---- Outer walls -------------------------------------------------
    const WH = 11, T = 2;
    this._addBox(0, 0, -H - T / 2, ARENA_SIZE + T * 2, WH, T, wallMat);
    this._addBox(0, 0, H + T / 2, ARENA_SIZE + T * 2, WH, T, wallMat);
    this._addBox(-H - T / 2, 0, 0, T, WH, ARENA_SIZE + T * 2, wallMat);
    this._addBox(H + T / 2, 0, 0, T, WH, ARENA_SIZE + T * 2, wallMat);
    // Ceiling blocker (invisible) so nothing escapes upward.
    this.boxes.push(new THREE.Box3(
      new THREE.Vector3(-H - 4, 24, -H - 4), new THREE.Vector3(H + 4, 30, H + 4)
    ));

    // Neon wall trim
    for (const [x, z, w, d] of [[0, -H, ARENA_SIZE, 0.2], [0, H, ARENA_SIZE, 0.2], [-H, 0, 0.2, ARENA_SIZE], [H, 0, 0.2, ARENA_SIZE]]) {
      this._addTrim(x, 0.06, z, w, d, 0x2ee6ff);
      this._addTrim(x, 4.2, z, w, d, 0xff2e88);
    }

    // ---- Central raised platform with steps --------------------------
    this._addBox(0, 0, 0, 14, 1.4, 14, blockMat2);
    this._addTrim(0, 1.46, 0, 14, 14, 0x2ee6ff);
    for (let i = 0; i < 3; i++) {
      const h = 1.4 * (i + 1) / 4;
      const off = 7 + (3 - i) * 0.9;
      this._addBox(0, 0, off, 6, h, 0.9, blockMat);
      this._addBox(0, 0, -off, 6, h, 0.9, blockMat);
      this._addBox(off, 0, 0, 0.9, h, 6, blockMat);
      this._addBox(-off, 0, 0, 0.9, h, 6, blockMat);
    }
    // Centrepiece obelisk
    const ob = this._addBox(0, 1.4, 0, 2.2, 5.5, 2.2, blockMat2);
    void ob;
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 0),
      new THREE.MeshBasicMaterial({ color: 0xff2e88 })
    );
    core.position.set(0, 7.6, 0);
    this.group.add(core);
    this.core = core;
    const coreLight = new THREE.PointLight(0xff2e88, 60, 34, 2);
    coreLight.position.set(0, 7.6, 0);
    this.group.add(coreLight);
    this.coreLight = coreLight;

    // ---- Corner towers ----------------------------------------------
    const cornerAt = (sx, sz) => {
      const x = sx * 22, z = sz * 22;
      this._addBox(x, 0, z, 9, 3.2, 9, blockMat2);
      this._addTrim(x, 3.26, z, 9, 9, 0xff2e88);
      this._addBox(x + sx * 2.6, 0, z + sz * 2.6, 3.4, 6.5, 3.4, blockMat);
      // ramp-ish steps up the inner face
      for (let i = 0; i < 4; i++) {
        const h = 3.2 * (i + 1) / 5;
        this._addBox(x - sx * (5.2 + i * 1.0), 0, z - sz * (5.2 + i * 1.0), 4.5, h, 4.5, blockMat);
      }
    };
    cornerAt(1, 1); cornerAt(1, -1); cornerAt(-1, 1); cornerAt(-1, -1);

    // ---- Scattered cover --------------------------------------------
    const placed = [];
    const fits = (x, z, r) => {
      if (Math.hypot(x, z) < 11) return false;
      for (const p of placed) if (Math.hypot(p.x - x, p.z - z) < r + p.r) return false;
      return true;
    };
    let tries = 0;
    while (placed.length < 26 && tries++ < 900) {
      const x = (rnd() * 2 - 1) * (H - 5);
      const z = (rnd() * 2 - 1) * (H - 5);
      const w = 1.6 + rnd() * 3.4;
      const d = 1.6 + rnd() * 3.4;
      const h = 1.1 + rnd() * 4.2;
      const r = Math.max(w, d) / 2 + 2.2;
      // keep clear of corner towers
      if (Math.abs(Math.abs(x) - 22) < 7 && Math.abs(Math.abs(z) - 22) < 7) continue;
      if (!fits(x, z, r)) continue;
      placed.push({ x, z, r });
      this._addBox(x, 0, z, w, h, d, rnd() > 0.5 ? blockMat : blockMat2);
      this._addTrim(x, h + 0.05, z, w, d, rnd() > 0.5 ? 0x2ee6ff : 0xff2e88);
      if (rnd() > 0.6) {
        const h2 = 0.8 + rnd() * 1.6;
        this._addBox(x + (rnd() - 0.5) * w * 0.4, h, z + (rnd() - 0.5) * d * 0.4, w * 0.55, h2, d * 0.55, blockMat);
      }
    }

    // ---- Hanging light bars -----------------------------------------
    const barMat = new THREE.MeshBasicMaterial({ color: 0x8ff6ff });
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(ARENA_SIZE * 0.9, 0.14, 0.3), barMat);
      bar.position.set(0, 9.4, i * 13);
      this.group.add(bar);
    }

    // ---- Lighting ----------------------------------------------------
    const hemi = new THREE.HemisphereLight(0x6a7cff, 0x180c24, 0.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xbfd8ff, 1.7);
    key.position.set(24, 40, 18);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const cam = key.shadow.camera;
    cam.left = -46; cam.right = 46; cam.top = 46; cam.bottom = -46; cam.near = 1; cam.far = 110;
    key.shadow.bias = -0.0012;
    key.shadow.normalBias = 0.035;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3f8a, 0.5);
    rim.position.set(-20, 14, -26);
    scene.add(rim);
    this.lights = { hemi, key, rim };

    // ---- Spawn points ------------------------------------------------
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const rr = 16 + (i % 4) * 5.5;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      if (Math.abs(x) > H - 3 || Math.abs(z) > H - 3) continue;
      const y = this.groundHeight(x, z);
      if (y > 6) continue;
      this.spawnPoints.push(new THREE.Vector3(x, y, z));
    }
  }

  // Highest solid surface at (x,z) — used for spawning and drops.
  groundHeight(x, z) {
    let best = 0;
    for (const b of this.boxes) {
      if (b.min.y > 12) continue;
      if (x > b.min.x - 0.3 && x < b.max.x + 0.3 && z > b.min.z - 0.3 && z < b.max.z + 0.3) {
        if (b.max.y > best) best = b.max.y;
      }
    }
    return best;
  }

  update(dt, t) {
    if (this.core) {
      this.core.rotation.y += dt * 0.6;
      this.core.rotation.x += dt * 0.25;
      const p = 1 + Math.sin(t * 2.2) * 0.12;
      this.core.scale.setScalar(p);
      this.coreLight.intensity = 45 + Math.sin(t * 2.2) * 18;
    }
  }
}
