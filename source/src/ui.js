const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), cross: $('cross'), cu: $('cu'), cd: $('cd'), cl: $('cl'), cr: $('cr'),
      hitmark: $('hitmark'), floaters: $('floaters'), dirs: $('dirs'),
      hpnum: $('hpnum'), hpfill: $('hpfill'), hplag: $('hplag'), shbar: $('shbar'), shfill: $('shfill'), shlbl: $('shlbl'),
      wname: $('wname'), anum: $('anum'), reloadbar: $('reloadbar'), slots: [...document.querySelectorAll('.slot')],
      dash: $('dash'), wavenum: $('wavenum'), enemyleft: $('enemyleft'), wavebarfill: $('wavebarfill'),
      scorenum: $('scorenum'), combo: $('combo'), combofill: $('combofill'),
      feed: $('feed'), banner: $('banner'), toast: $('toast'), fps: $('fps'),
      dmgflash: $('dmgflash'), healpulse: $('healpulse'), lowhp: $('lowhp'), speedlines: $('speedlines'),
      start: $('start'), pause: $('pause'), upgrade: $('upgrade'), gameover: $('gameover'),
      cards: $('cards'), gostats: $('gostats'), upgtitle: $('upgtitle'),
    };
    this.floatPool = [];
    this.dirPool = [];
    this.hitT = 0;
    this.dispScore = 0;
    this.targetScore = 0;
    this._pips = 0;
    this._toastT = 0;
    this._bannerT = 0;
  }

  // ---------- crosshair ----------
  setCrosshair(spreadPx, hot) {
    const g = 4 + spreadPx;
    this.el.cu.style.transform = `translateY(${-g - 9}px)`;
    this.el.cd.style.transform = `translateY(${g}px)`;
    this.el.cl.style.transform = `translateX(${-g - 9}px)`;
    this.el.cr.style.transform = `translateX(${g}px)`;
    const c = hot ? '#ff2e88' : '#eafcff';
    for (const e of [this.el.cu, this.el.cd, this.el.cl, this.el.cr]) e.style.background = c;
  }

  hitmarker(kind) {
    const h = this.el.hitmark;
    h.className = kind;
    h.style.opacity = '1';
    h.style.transform = 'scale(1.5)';
    this.hitT = kind === 'kill' ? 0.34 : 0.2;
    requestAnimationFrame(() => { h.style.transition = 'transform .1s ease-out'; h.style.transform = 'scale(1)'; });
  }

  // ---------- floating damage ----------
  float(x, y, text, cls) {
    let e = this.floatPool.find(f => f._free);
    if (!e) {
      if (this.floatPool.length > 44) return;
      e = document.createElement('div');
      this.el.floaters.appendChild(e);
      this.floatPool.push(e);
    }
    e._free = false;
    e.className = 'fnum ' + (cls || '');
    e.textContent = text;
    const dx = (Math.random() - 0.5) * 34;
    const dy = -46 - Math.random() * 26;
    e.style.transition = 'none';
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    e.style.opacity = '1';
    e.style.transform = 'translate(-50%,-50%) scale(1.5)';
    requestAnimationFrame(() => {
      e.style.transition = 'transform .78s cubic-bezier(.15,.9,.3,1), opacity .78s ease-in';
      e.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`;
      e.style.opacity = '0';
    });
    setTimeout(() => { e._free = true; }, 800);
  }

  damageDir(angle) {
    let e = this.dirPool.find(f => f._free);
    if (!e) {
      if (this.dirPool.length > 8) return;
      e = document.createElement('div');
      e.className = 'dmgdir';
      e.innerHTML = '<b></b>';
      this.el.dirs.appendChild(e);
      this.dirPool.push(e);
    }
    e._free = false;
    const b = e.firstChild;
    b.style.transition = 'none';
    b.style.transform = `rotate(${angle}rad)`;
    b.style.opacity = '1';
    requestAnimationFrame(() => {
      b.style.transition = 'opacity 1.1s ease-out';
      b.style.opacity = '0';
    });
    setTimeout(() => { e._free = true; }, 1200);
  }

  // ---------- vitals ----------
  setHealth(hp, max, shield, shieldMax) {
    this.el.hpnum.innerHTML = `${Math.ceil(hp)}<small>/${max}</small>`;
    const k = Math.max(0, hp / max);
    this.el.hpfill.style.transform = `scaleX(${k})`;
    this.el.hplag.style.transform = `scaleX(${k})`;
    if (shieldMax > 0) {
      this.el.shbar.classList.remove('hide');
      this.el.shfill.style.transform = `scaleX(${Math.max(0, shield / shieldMax)})`;
      this.el.shlbl.textContent = `SHIELD ${Math.ceil(shield)}`;
    } else {
      this.el.shbar.classList.add('hide');
      this.el.shlbl.textContent = '';
    }
    this.el.lowhp.classList.toggle('on', k < 0.32 && hp > 0);
  }

  flashDamage() {
    this.el.dmgflash.style.opacity = '0.9';
    setTimeout(() => { this.el.dmgflash.style.opacity = '0'; }, 90);
  }

  flashHeal() {
    this.el.healpulse.style.opacity = '0.8';
    setTimeout(() => { this.el.healpulse.style.opacity = '0'; }, 120);
  }

  setSpeedLines(k) { this.el.speedlines.style.opacity = k.toFixed(2); }

  // ---------- ammo ----------
  setAmmo(name, cur, mag, reloadK, index, unlocked, color) {
    this.el.wname.textContent = name;
    this.el.wname.style.color = color;
    this.el.anum.innerHTML = `${cur}<small>/${mag}</small>`;
    this.el.anum.classList.toggle('low', cur / mag <= 0.25);
    this.el.reloadbar.style.transform = `scaleX(${reloadK})`;
    this.el.reloadbar.style.opacity = reloadK > 0 ? '1' : '0';
    this.el.slots.forEach((s, i) => {
      s.classList.toggle('on', i === index);
      s.classList.toggle('locked', !unlocked[i]);
    });
  }

  setDash(charges, max) {
    if (this._pips !== max) {
      this.el.dash.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const d = document.createElement('div');
        d.className = 'pip';
        this.el.dash.appendChild(d);
      }
      this._pips = max;
    }
    [...this.el.dash.children].forEach((p, i) => p.classList.toggle('on', i < charges));
  }

  // ---------- wave / score ----------
  setWave(n, left, total) {
    this.el.wavenum.textContent = 'WAVE ' + String(n).padStart(2, '0');
    this.el.enemyleft.textContent = left;
    this.el.wavebarfill.style.transform = `scaleX(${total ? 1 - left / total : 0})`;
  }

  setScore(score, comboMul, comboK) {
    this.targetScore = score;
    this.el.combo.style.opacity = comboMul > 1.001 ? '1' : '0';
    this.el.combo.textContent = `×${comboMul.toFixed(1)} COMBO`;
    this.el.combofill.style.transform = `scaleX(${comboK})`;
  }

  feedKill(text, color) {
    const d = document.createElement('div');
    d.className = 'feeditem';
    d.textContent = text;
    d.style.borderLeftColor = color;
    this.el.feed.appendChild(d);
    while (this.el.feed.children.length > 5) this.el.feed.removeChild(this.el.feed.firstChild);
    setTimeout(() => {
      d.style.transition = 'opacity .4s, transform .4s';
      d.style.opacity = '0';
      d.style.transform = 'translateX(-14px)';
      setTimeout(() => d.remove(), 420);
    }, 3200);
  }

  banner(l1, l2, l3, dur = 2.4, color = '#ff2e88') {
    const b = this.el.banner;
    b.querySelector('.b1').textContent = l1;
    b.querySelector('.b2').textContent = l2;
    b.querySelector('.b3').textContent = l3 || '';
    b.querySelector('.b2').style.textShadow = `0 0 40px ${color}, 0 6px 0 rgba(0,0,0,.4)`;
    b.querySelector('.b1').style.color = color;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = `bannerIn ${dur}s ease-out`;
  }

  toast(text) {
    const t = this.el.toast;
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('on'), 2200);
  }

  // ---------- screens ----------
  show(id) { this.el[id].classList.remove('hide'); }
  hide(id) { this.el[id].classList.add('hide'); }

  showUpgrades(list, onPick) {
    this.el.cards.innerHTML = '';
    list.forEach((u, i) => {
      const c = document.createElement('div');
      c.className = 'card ' + u.rarity;
      c.style.animationDelay = (i * 0.07) + 's';
      c.innerHTML = `<div class="rr"></div><div class="tag">${u.rarity.toUpperCase()}</div>
        <div class="ic">${u.icon}</div><div class="nm">${u.name}</div><div class="ds">${u.text}</div>`;
      c.onclick = () => onPick(u);
      this.el.cards.appendChild(c);
    });
    this.show('upgrade');
  }

  showGameOver(stats) {
    this.el.gostats.innerHTML = stats.map(([k, v, big]) =>
      `<span>${k}</span><span class="${big ? 'big' : ''}">${v}</span>`).join('');
    this.show('gameover');
  }

  update(dt) {
    if (this.hitT > 0) {
      this.hitT -= dt;
      if (this.hitT <= 0) {
        this.el.hitmark.style.transition = 'opacity .12s';
        this.el.hitmark.style.opacity = '0';
      }
    }
    // score count-up
    if (this.dispScore !== this.targetScore) {
      const d = this.targetScore - this.dispScore;
      this.dispScore += Math.sign(d) * Math.max(1, Math.abs(d) * Math.min(1, dt * 9));
      if (Math.abs(this.targetScore - this.dispScore) < 1) this.dispScore = this.targetScore;
      this.el.scorenum.textContent = Math.round(this.dispScore).toLocaleString();
    }
  }
}
