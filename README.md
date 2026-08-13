# NEON BREACH

A wave-based arena FPS that runs in the browser. No install, no build step, no
external assets — the whole game is a single self-contained `index.html`
(three.js inlined, every sound synthesized at runtime, every texture drawn to a
canvas on load).

**Play:** open `index.html`, or visit the GitHub Pages deployment.

## The game

Survive escalating waves inside a neon grid arena. Every cleared wave offers a
choice of three augments, so each run builds a different character.

**Controls**

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Look / fire |
| `Space` | Jump, then double jump |
| `Shift` | Dash (rechargeable charges) |
| `Ctrl` | Sprint |
| `R` | Reload |
| `1` `2` `3` / `Q` / wheel | Switch weapon |
| `M` / `P` | Mute / pause |

**Weapons** — Pulse Rifle (full auto), Scattergun (unlocks wave 3), Railgun
(charge-up, pierces everything, unlocks wave 6).

**Enemies** — Seekers swarm and ram, Spitters keep their distance and lob
plasma, Wisps blink around the arena firing bursts, Brutes soak damage and hit
like a truck.

**Augments** — 15 stackable upgrades across three rarities: damage, fire rate,
crit, lifesteal, regenerating shields, extra dashes and air jumps, and
detonation cores that make every kill explode.

## Technical notes

- Rendering: three.js r169, PBR materials lit by a procedurally generated
  environment map, ACES filmic tonemapping, real-time shadows.
- Physics: hand-rolled swept-AABB character controller with step-up, plus
  sphere-vs-box resolution for enemies. Hitscan weapons use ray/sphere and
  ray/AABB tests with separate head hitboxes.
- Effects: a single GPU-instanced particle system (5k points), instanced debris
  shards, pooled tracers, shock rings, decals and flash lights — no allocations
  in the hot loop.
- Audio: everything is WebAudio synthesis — weapon reports, impacts, UI, and an
  adaptive synthwave score that gains layers and tempo as waves escalate.
- Feel: trauma-based screen shake, FOV kick, strafe tilt, landing dip, weapon
  sway and bob, hit markers, floating damage numbers, combo multiplier, and
  slow-motion on heavy kills and wave clears.

## Repository layout

```
index.html      the built, self-contained game (this is what ships)
source/         the readable source
  src/          game modules (arena, player, weapons, enemies, fx, ui, audio)
  vendor/       three.js
  index.html    dev shell (loads src/ via importmap)
  build.mjs     bundles source/ into the root index.html
  serve.mjs     no-cache static server for local development
```

## Development

```bash
cd source
node serve.mjs          # http://localhost:5178
node build.mjs ../index.html   # rebuild the shipped single-file build
```

`build.mjs` needs esbuild (`npm i --no-save esbuild`).

## Deploy

Static — publish the repository root anywhere. The included GitHub Actions
workflow deploys to GitHub Pages on every push to `main`.
