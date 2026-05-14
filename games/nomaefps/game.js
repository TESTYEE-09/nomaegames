const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const menu = document.querySelector("#menu");
const scoreEl = document.querySelector("#score");
const healthEl = document.querySelector("#health");
const ammoEl = document.querySelector("#ammo");

const keys = new Set();
const player = { x: 0, y: 0, angle: 0, health: 100, ammo: 18, score: 0, cooldown: 0, reload: 0 };
const arena = { width: 28, height: 20 };
const enemies = [];
let running = false;
let lastTime = performance.now();
let shake = 0;

function resetGame() {
  player.x = 0;
  player.y = 0;
  player.angle = 0;
  player.health = 100;
  player.ammo = 18;
  player.score = 0;
  player.cooldown = 0;
  player.reload = 0;
  enemies.length = 0;
  for (let i = 0; i < 8; i += 1) spawnEnemy();
  updateHud();
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  const enemy = {
    x: side === 0 ? -12 : side === 1 ? 12 : Math.random() * 24 - 12,
    y: side === 2 ? -8 : side === 3 ? 8 : Math.random() * 16 - 8,
    speed: 1.4 + Math.random() * 0.8,
    hp: 2,
    hit: 0,
  };
  enemies.push(enemy);
}

function updateHud() {
  scoreEl.textContent = player.score;
  healthEl.textContent = Math.max(0, Math.round(player.health));
  ammoEl.textContent = player.reload > 0 ? "..." : player.ammo;
}

function clampToArena() {
  player.x = Math.max(-arena.width / 2, Math.min(arena.width / 2, player.x));
  player.y = Math.max(-arena.height / 2, Math.min(arena.height / 2, player.y));
}

function shoot() {
  if (!running || player.cooldown > 0 || player.reload > 0) return;
  if (player.ammo <= 0) {
    player.reload = 0.85;
    return;
  }

  player.ammo -= 1;
  player.cooldown = 0.16;
  shake = 5;

  const aimX = Math.cos(player.angle);
  const aimY = Math.sin(player.angle);
  let best = null;
  let bestDistance = Infinity;

  for (const enemy of enemies) {
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    const forward = dx * aimX + dy * aimY;
    if (forward < 0) continue;
    const miss = Math.abs(dx * aimY - dy * aimX);
    if (miss < 0.78 && distance < bestDistance) {
      best = enemy;
      bestDistance = distance;
    }
  }

  if (best) {
    best.hp -= 1;
    best.hit = 0.12;
    if (best.hp <= 0) {
      enemies.splice(enemies.indexOf(best), 1);
      player.score += 100;
      spawnEnemy();
    }
  }

  updateHud();
}

function update(dt) {
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.reload = Math.max(0, player.reload - dt);
  if (player.reload === 0 && player.ammo === 0) player.ammo = 18;
  shake = Math.max(0, shake - dt * 18);

  const turn = (keys.has("ArrowLeft") ? -1 : 0) + (keys.has("ArrowRight") ? 1 : 0);
  player.angle += turn * dt * 2.6;

  const forward = (keys.has("w") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("s") || keys.has("ArrowDown") ? 1 : 0);
  const strafe = (keys.has("d") ? 1 : 0) - (keys.has("a") ? 1 : 0);
  const speed = 5.4;
  player.x += (Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe) * speed * dt;
  player.y += (Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe) * speed * dt;
  clampToArena();

  for (const enemy of enemies) {
    enemy.hit = Math.max(0, enemy.hit - dt);
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.max(0.001, Math.hypot(dx, dy));
    enemy.x += (dx / distance) * enemy.speed * dt;
    enemy.y += (dy / distance) * enemy.speed * dt;
    if (distance < 1.05) {
      player.health -= 18 * dt;
      if (player.health <= 0) {
        running = false;
        menu.classList.remove("is-hidden");
        menu.querySelector("p").textContent = `SCORE ${player.score}`;
        menu.querySelector("h1").textContent = "Try Again";
      }
    }
  }

  updateHud();
}

function project(enemy) {
  const dx = enemy.x - player.x;
  const dy = enemy.y - player.y;
  const distance = Math.hypot(dx, dy);
  let angle = Math.atan2(dy, dx) - player.angle;
  angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  return { angle, distance };
}

function draw() {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const jolt = shake ? (Math.random() - 0.5) * shake : 0;
  const horizon = height * 0.48 + jolt;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#152238");
  sky.addColorStop(1, "#25364a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, horizon);

  const floor = ctx.createLinearGradient(0, horizon, 0, height);
  floor.addColorStop(0, "#15181d");
  floor.addColorStop(1, "#08090d");
  ctx.fillStyle = floor;
  ctx.fillRect(0, horizon, width, height - horizon);

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 18; i += 1) {
    const y = horizon + i * 28;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const visible = enemies
    .map((enemy) => ({ enemy, ...project(enemy) }))
    .filter((item) => Math.abs(item.angle) < 1.1)
    .sort((a, b) => b.distance - a.distance);

  for (const item of visible) {
    const scale = Math.min(3.2, 9 / item.distance);
    const x = width / 2 + Math.tan(item.angle) * width * 0.72;
    const bodyH = 96 * scale;
    const bodyW = 46 * scale;
    const y = horizon + 140 / item.distance - bodyH * 0.7;

    ctx.fillStyle = item.enemy.hit > 0 ? "#f8ff7a" : "#55e6ff";
    ctx.shadowColor = "rgba(85,230,255,0.45)";
    ctx.shadowBlur = 24;
    ctx.fillRect(x - bodyW / 2, y, bodyW, bodyH);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#10131a";
    ctx.fillRect(x - bodyW / 5, y + bodyH * 0.22, bodyW / 2.5, bodyH * 0.12);
  }

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(width / 2 - 22, height - 88 + jolt, 44, 70);
  ctx.fillStyle = "#f8ff7a";
  ctx.fillRect(width / 2 - 8, height - 116 + jolt, 16, 46);
}

function frame(now) {
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;
  if (running) update(dt);
  draw();
  requestAnimationFrame(frame);
}

startButton.addEventListener("click", async () => {
  resetGame();
  running = true;
  menu.classList.add("is-hidden");
  canvas.focus();
  if (canvas.requestPointerLock) {
    try {
      await canvas.requestPointerLock();
    } catch {
      // Pointer lock is optional; keyboard turning still works.
    }
  }
});

window.addEventListener("keydown", (event) => {
  keys.add(event.key.toLowerCase());
  if (event.key.toLowerCase() === "r" && player.ammo < 18) player.reload = 0.85;
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === canvas) player.angle += event.movementX * 0.0022;
});

window.addEventListener("mousedown", shoot);

resetGame();
requestAnimationFrame(frame);
