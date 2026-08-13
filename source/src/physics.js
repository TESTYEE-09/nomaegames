import * as THREE from 'three';

const _b = new THREE.Box3();

export function makeAABB(pos, hx, hy2, hz, out) {
  // pos is the FEET position; hy2 is total height.
  out.min.set(pos.x - hx, pos.y, pos.z - hz);
  out.max.set(pos.x + hx, pos.y + hy2, pos.z + hz);
  return out;
}

function overlaps(a, b) {
  return a.min.x < b.max.x && a.max.x > b.min.x &&
         a.min.y < b.max.y && a.max.y > b.min.y &&
         a.min.z < b.max.z && a.max.z > b.min.z;
}

/**
 * Axis-separated AABB sweep against static boxes.
 * pos: THREE.Vector3 feet position (mutated)
 * Returns { hitX, hitY, hitZ, grounded, ceiling }
 */
export function moveAndCollide(pos, delta, hx, height, boxes, stepHeight = 0.55) {
  const res = { hitX: false, hitY: false, hitZ: false, grounded: false, ceiling: false };
  const box = _b;

  // --- Y ---
  if (delta.y !== 0) {
    pos.y += delta.y;
    makeAABB(pos, hx, height, hx, box);
    for (const b of boxes) {
      if (!overlaps(box, b)) continue;
      if (delta.y < 0) { pos.y = b.max.y; res.grounded = true; }
      else { pos.y = b.min.y - height; res.ceiling = true; }
      res.hitY = true;
      makeAABB(pos, hx, height, hx, box);
    }
  }

  // --- X ---
  if (delta.x !== 0) {
    const startY = pos.y;
    pos.x += delta.x;
    makeAABB(pos, hx, height, hx, box);
    let blocked = null;
    for (const b of boxes) {
      if (overlaps(box, b)) { blocked = b; break; }
    }
    if (blocked) {
      // Try stepping up onto low ledges.
      const rise = blocked.max.y - pos.y;
      let stepped = false;
      if (rise > 0 && rise <= stepHeight) {
        const savedY = pos.y;
        pos.y = blocked.max.y + 0.001;
        makeAABB(pos, hx, height, hx, box);
        let clear = true;
        for (const b of boxes) if (overlaps(box, b)) { clear = false; break; }
        if (clear) stepped = true; else pos.y = savedY;
      }
      if (!stepped) {
        pos.y = startY;
        pos.x -= delta.x;
        // Snap flush against the surface.
        makeAABB(pos, hx, height, hx, box);
        const sign = Math.sign(delta.x);
        let limit = pos.x + delta.x;
        for (const b of boxes) {
          const yOver = box.min.y < b.max.y && box.max.y > b.min.y;
          const zOver = box.min.z < b.max.z && box.max.z > b.min.z;
          if (!yOver || !zOver) continue;
          if (sign > 0 && b.min.x >= box.max.x) limit = Math.min(limit, b.min.x - hx - 0.001);
          if (sign < 0 && b.max.x <= box.min.x) limit = Math.max(limit, b.max.x + hx + 0.001);
        }
        pos.x = sign > 0 ? Math.min(pos.x + delta.x, limit) : Math.max(pos.x + delta.x, limit);
        res.hitX = true;
      }
    }
  }

  // --- Z ---
  if (delta.z !== 0) {
    const startY = pos.y;
    pos.z += delta.z;
    makeAABB(pos, hx, height, hx, box);
    let blocked = null;
    for (const b of boxes) {
      if (overlaps(box, b)) { blocked = b; break; }
    }
    if (blocked) {
      const rise = blocked.max.y - pos.y;
      let stepped = false;
      if (rise > 0 && rise <= stepHeight) {
        const savedY = pos.y;
        pos.y = blocked.max.y + 0.001;
        makeAABB(pos, hx, height, hx, box);
        let clear = true;
        for (const b of boxes) if (overlaps(box, b)) { clear = false; break; }
        if (clear) stepped = true; else pos.y = savedY;
      }
      if (!stepped) {
        pos.y = startY;
        pos.z -= delta.z;
        makeAABB(pos, hx, height, hx, box);
        const sign = Math.sign(delta.z);
        let limit = pos.z + delta.z;
        for (const b of boxes) {
          const yOver = box.min.y < b.max.y && box.max.y > b.min.y;
          const xOver = box.min.x < b.max.x && box.max.x > b.min.x;
          if (!yOver || !xOver) continue;
          if (sign > 0 && b.min.z >= box.max.z) limit = Math.min(limit, b.min.z - hx - 0.001);
          if (sign < 0 && b.max.z <= box.min.z) limit = Math.max(limit, b.max.z + hx + 0.001);
        }
        pos.z = sign > 0 ? Math.min(pos.z + delta.z, limit) : Math.max(pos.z + delta.z, limit);
        res.hitZ = true;
      }
    }
  }

  // Ground probe (small tolerance so we stay "grounded" over seams).
  if (!res.grounded) {
    makeAABB(pos, hx, height, hx, box);
    box.min.y -= 0.12;
    for (const b of boxes) {
      if (overlaps(box, b) && b.max.y <= pos.y + 0.13 && b.max.y >= pos.y - 0.2) { res.grounded = true; break; }
    }
    if (pos.y <= 0.001) { pos.y = Math.max(0, pos.y); res.grounded = true; }
  }
  if (pos.y < 0) { pos.y = 0; res.grounded = true; }
  return res;
}

/** Push a sphere out of static boxes along the smallest penetration axis. */
export function resolveSphere(pos, radius, boxes) {
  let hit = false;
  for (const b of boxes) {
    const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
    const cy = Math.max(b.min.y, Math.min(pos.y, b.max.y));
    const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
    const dx = pos.x - cx, dy = pos.y - cy, dz = pos.z - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > radius * radius) continue;
    hit = true;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2), k = (radius - d) / d;
      pos.x += dx * k; pos.y += dy * k; pos.z += dz * k;
    } else {
      // Center inside the box: eject along the shallowest face.
      const px = Math.min(pos.x - b.min.x, b.max.x - pos.x);
      const py = Math.min(pos.y - b.min.y, b.max.y - pos.y);
      const pz = Math.min(pos.z - b.min.z, b.max.z - pos.z);
      if (px <= py && px <= pz) pos.x += (pos.x - (b.min.x + b.max.x) / 2 > 0 ? px : -px) + radius * 0.1;
      else if (py <= pz) pos.y += (pos.y - (b.min.y + b.max.y) / 2 > 0 ? py : -py) + radius * 0.1;
      else pos.z += (pos.z - (b.min.z + b.max.z) / 2 > 0 ? pz : -pz) + radius * 0.1;
    }
  }
  return hit;
}

/** Ray vs AABB slab test. Returns distance or Infinity. */
export function rayBox(ro, rd, box) {
  let tmin = 0, tmax = Infinity;
  for (const ax of ['x', 'y', 'z']) {
    const inv = 1 / rd[ax];
    let t1 = (box.min[ax] - ro[ax]) * inv;
    let t2 = (box.max[ax] - ro[ax]) * inv;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmax < tmin) return Infinity;
  }
  return tmin;
}

/** Ray vs sphere. Returns nearest positive distance or Infinity. */
export function raySphere(ro, rd, center, radius) {
  const ox = ro.x - center.x, oy = ro.y - center.y, oz = ro.z - center.z;
  const b = ox * rd.x + oy * rd.y + oz * rd.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t0 = -b - s;
  if (t0 >= 0) return t0;
  const t1 = -b + s;
  return t1 >= 0 ? t1 : Infinity;
}

/** Nearest static-geometry hit distance along a ray. */
export function rayWorld(ro, rd, boxes, maxDist) {
  let best = maxDist;
  for (const b of boxes) {
    const t = rayBox(ro, rd, b);
    if (t < best) best = t;
  }
  return best;
}

export function lineOfSight(a, b, boxes) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.001) return true;
  const rd = { x: dx / len, y: dy / len, z: dz / len };
  return rayWorld(a, rd, boxes, len) >= len - 0.05;
}
