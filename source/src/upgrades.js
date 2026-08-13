// Roguelite upgrade cards offered between waves.

export const UPGRADES = [
  {
    id: 'dmg', name: 'OVERCHARGE', icon: '⚡', rarity: 'common', max: 6,
    desc: p => `+22% weapon damage  <em>(now ${Math.round(p.stats.damageMul * 100)}%)</em>`,
    apply: p => { p.stats.damageMul *= 1.22; },
  },
  {
    id: 'rof', name: 'HAIR TRIGGER', icon: '🔥', rarity: 'common', max: 5,
    desc: p => `+16% fire rate  <em>(now ${Math.round(p.stats.fireRateMul * 100)}%)</em>`,
    apply: p => { p.stats.fireRateMul *= 1.16; },
  },
  {
    id: 'mag', name: 'EXTENDED MAG', icon: '🧲', rarity: 'common', max: 4,
    desc: p => `+40% magazine size  <em>(now ${Math.round(p.stats.magMul * 100)}%)</em>`,
    apply: p => { p.stats.magMul *= 1.4; },
  },
  {
    id: 'reload', name: 'QUICK HANDS', icon: '🌀', rarity: 'common', max: 4,
    desc: p => `-22% reload time  <em>(now ${Math.round(p.stats.reloadMul * 100)}%)</em>`,
    apply: p => { p.stats.reloadMul *= 0.78; },
  },
  {
    id: 'hp', name: 'REINFORCED FRAME', icon: '❤', rarity: 'common', max: 6,
    desc: p => `+30 max integrity, fully repaired  <em>(now ${p.stats.maxHp})</em>`,
    apply: p => { p.stats.maxHp += 30; p.hp = p.stats.maxHp; },
  },
  {
    id: 'crit', name: 'WEAK POINT SCAN', icon: '🎯', rarity: 'uncommon', max: 5,
    desc: p => `+12% critical chance  <em>(now ${Math.round(p.stats.critChance * 100)}%)</em>`,
    apply: p => { p.stats.critChance = Math.min(1, p.stats.critChance + 0.12); },
  },
  {
    id: 'critdmg', name: 'EXECUTIONER', icon: '💀', rarity: 'uncommon', max: 4,
    desc: p => `+60% critical damage  <em>(now ${Math.round(p.stats.critMul * 100)}%)</em>`,
    apply: p => { p.stats.critMul += 0.6; },
  },
  {
    id: 'speed', name: 'KINETIC WEAVE', icon: '💨', rarity: 'common', max: 4,
    desc: p => `+12% move speed  <em>(now ${(p.stats.speed).toFixed(1)} m/s)</em>`,
    apply: p => { p.stats.speed *= 1.12; },
  },
  {
    id: 'dash', name: 'PHASE CELL', icon: '⟫', rarity: 'uncommon', max: 3,
    desc: p => `+1 dash charge  <em>(now ${p.stats.dashMax + 1})</em>`,
    apply: p => { p.stats.dashMax += 1; p.dashCharges = p.stats.dashMax; },
  },
  {
    id: 'jump', name: 'GRAV BOOTS', icon: '⤴', rarity: 'uncommon', max: 2,
    desc: p => `+1 mid-air jump  <em>(now ${p.stats.jumps + 1})</em>`,
    apply: p => { p.stats.jumps += 1; },
  },
  {
    id: 'lifesteal', name: 'SIPHON ROUNDS', icon: '🩸', rarity: 'rare', max: 4,
    desc: p => `Kills restore +5 integrity  <em>(now ${p.stats.lifesteal + 5})</em>`,
    apply: p => { p.stats.lifesteal += 5; },
  },
  {
    id: 'shield', name: 'HARD LIGHT SHELL', icon: '🛡', rarity: 'rare', max: 4,
    desc: p => `+40 regenerating shield  <em>(now ${p.stats.shieldMax + 40})</em>`,
    apply: p => { p.stats.shieldMax += 40; p.shield = p.stats.shieldMax; },
  },
  {
    id: 'explode', name: 'DETONATION CORE', icon: '💥', rarity: 'rare', max: 4,
    desc: p => `Kills detonate for ${40 + p.stats.explosive * 30} area damage`,
    apply: p => { p.stats.explosive += 1; },
  },
  {
    id: 'head', name: 'NEURAL TARGETING', icon: '🧠', rarity: 'uncommon', max: 4,
    desc: p => `+50% headshot damage  <em>(now ${Math.round(p.stats.headshotMul * 100)}%)</em>`,
    apply: p => { p.stats.headshotMul += 0.5; },
  },
  {
    id: 'regen', name: 'NANO REPAIR', icon: '✚', rarity: 'rare', max: 3,
    desc: p => `Regenerate ${(p.stats.regenHealth || 0) + 4}/s out of combat`,
    apply: p => { p.stats.regenHealth = (p.stats.regenHealth || 0) + 4; },
  },
];

const RARITY_WEIGHT = { common: 10, uncommon: 5, rare: 2.4 };

export function rollUpgrades(player, taken, n = 3) {
  const pool = UPGRADES.filter(u => (taken[u.id] || 0) < u.max);
  const picks = [];
  const bag = pool.slice();
  while (picks.length < n && bag.length) {
    let total = 0;
    for (const u of bag) total += RARITY_WEIGHT[u.rarity];
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < bag.length; i++) {
      r -= RARITY_WEIGHT[bag[i].rarity];
      if (r <= 0) { idx = i; break; }
    }
    picks.push(bag.splice(idx, 1)[0]);
  }
  return picks.map(u => ({ ...u, text: u.desc(player) }));
}
