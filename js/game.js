// Level: streams an endless run of ground/platforms/terrain from a map def, handles collision + camera.
class Level {
  constructor(mapDef) {
    this.mapDef = mapDef;
    this.groundY = mapDef.groundY;
    this.pits = [];
    this.platforms = [];
    this.terrain = [];
    this.nextChunkIndex = 0;
    this.particles = [];
    this.onEat = null; // set by Game, called when an item is consumed
    this.ensureGenerated(mapDef.chunkWidth * 3); // a safe starting runway
  }

  // Generates chunks left-to-right until the level is built out past uptoX. The level never
  // "ends" - this just gets called again each frame with a further uptoX as the camera advances.
  ensureGenerated(uptoX) {
    while (this.nextChunkIndex * this.mapDef.chunkWidth < uptoX) {
      const chunk = generateChunk(this.mapDef, this.nextChunkIndex);
      this.pits.push(...chunk.pits);
      this.platforms.push(...chunk.platforms);
      this.terrain.push(...chunk.terrain);
      this.nextChunkIndex++;
    }
  }

  isPit(x) {
    return this.pits.some((p) => x > p[0] && x < p[1]);
  }

  // The Kirby-devours-the-ground ultimate: carves a gap into the ground just ahead of (x, facing)
  // and sweeps up any nearby terrain items as a bonus. Returns the consumed items for scoring.
  carveGround(x, facing) {
    const width = 170 + Math.random() * 40;
    const startX = facing >= 0 ? x + 30 : x - 30 - width;
    this.pits.push([startX, startX + width]);
    const consumed = [];
    for (const item of this.terrain) {
      if (item.eaten) continue;
      if (Math.abs(item.x - x) < 260) {
        item.eaten = true;
        consumed.push(item);
      }
    }
    return consumed;
  }

  spawnGroundBurst(x, y) {
    for (let i = 0; i < 20; i++) {
      this.particles.push({
        x, y: y - 10,
        vx: (Math.random() - 0.5) * 280,
        vy: -Math.random() * 240 - 60,
        life: 0.5 + Math.random() * 0.4,
        age: 0,
        color: i % 2 === 0 ? '#caa46b' : this.mapDef.theme.groundDark,
      });
    }
    this.particles.push({ text: '궁극기!', x, y: y - 70, vx: 0, vy: -55, life: 0.9, age: 0, isText: true });
  }

  // Returns the Y the player should rest on given current x, or null if airborne.
  getSupportY(x, y, prevY) {
    // platforms (only land when falling onto the top from above)
    for (const p of this.platforms) {
      if (x > p.x && x < p.x + p.w) {
        if (prevY <= p.y + 4 && y >= p.y) return p.y;
      }
    }
    if (!this.isPit(x)) {
      if (y >= this.groundY) return this.groundY;
    }
    return null;
  }

  spawnParticles(item, def) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: item.x,
        y: item.y - 20,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 180 - 40,
        life: 0.5 + Math.random() * 0.3,
        age: 0,
        color: def.color,
      });
    }
    this.particles.push({
      text: `+${def.value}`,
      x: item.x,
      y: item.y - 30,
      vx: 0,
      vy: -50,
      life: 0.8,
      age: 0,
      isText: true,
    });
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  drawBackground(ctx, camX, canvasW, canvasH) {
    const theme = this.mapDef.theme;
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    grad.addColorStop(0, theme.sky[0]);
    grad.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // parallax hills
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 6; i++) {
      const hx = (i * 380 - camX * 0.3) % (canvasW + 400) - 200;
      ctx.beginPath();
      ctx.ellipse(hx, this.groundY - 10, 160, 70, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  drawGround(ctx, camX, canvasW) {
    const theme = this.mapDef.theme;
    const startX = Math.max(0, camX - 50);
    const endX = camX + canvasW + 50;

    ctx.fillStyle = theme.groundDark;
    let segStart = null;
    for (let x = startX; x <= endX; x += 20) {
      const pit = this.isPit(x);
      if (!pit && segStart === null) segStart = x;
      if ((pit || x + 20 > endX) && segStart !== null) {
        const segEnd = pit ? x : endX;
        ctx.fillRect(segStart - camX, this.groundY, segEnd - segStart, 600);
        ctx.fillStyle = theme.ground;
        ctx.fillRect(segStart - camX, this.groundY, segEnd - segStart, 14);
        ctx.fillStyle = theme.groundDark;
        segStart = null;
      }
    }

    // platforms
    for (const p of this.platforms) {
      const sx = p.x - camX;
      if (sx + p.w < 0 || sx > canvasW) continue;
      ctx.fillStyle = theme.groundDark;
      ctx.fillRect(sx, p.y, p.w, 18);
      ctx.fillStyle = theme.ground;
      ctx.fillRect(sx, p.y, p.w, 6);
    }
  }

  drawParticles(ctx, camX) {
    for (const p of this.particles) {
      const alpha = Math.max(0, 1 - p.age / p.life);
      const sx = p.x - camX;
      if (p.isText) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ff5f9a';
        ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, sx, p.y);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

// Game: orchestrates state machine, physics tick, rendering, timer & score.
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    this.input = { left: false, right: false, jumpHeld: false, jumpPressed: false, eatPressed: false, ultimatePressed: false };
    this.status = 'idle'; // idle | playing | paused | over
    this.level = null;
    this.kirby = null;
    this.camX = 0;
    this.timeLeft = 60;
    this.elapsed = 0;
    this.lastTs = null;

    this.callbacks = {}; // onTick, onGameOver

    this._bindInput();
  }

  _bindInput() {
    const downKeys = new Set();
    window.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'Spacebar'].includes(e.key)) e.preventDefault();
      if (downKeys.has(e.code)) return;
      downKeys.add(e.code);
      this._handleKey(e.code, true);
    });
    window.addEventListener('keyup', (e) => {
      downKeys.delete(e.code);
      this._handleKey(e.code, false);
    });
  }

  _handleKey(code, down) {
    if (code === 'ArrowLeft' || code === 'KeyA') this.input.left = down;
    if (code === 'ArrowRight' || code === 'KeyD') this.input.right = down;
    if (code === 'ArrowUp' || code === 'Space' || code === 'KeyW') {
      if (down && !this.input.jumpHeld) this.input.jumpPressed = true;
      this.input.jumpHeld = down;
    }
    if (code === 'KeyZ' || code === 'Enter' || code === 'KeyJ') {
      if (down) this.input.eatPressed = true;
    }
    if (code === 'KeyX' || code === 'ShiftLeft' || code === 'ShiftRight') {
      if (down) this.input.ultimatePressed = true;
    }
    if (code === 'Escape' && down && this.status === 'playing') {
      this.callbacks.onPauseRequest && this.callbacks.onPauseRequest();
    }
  }

  // ---- touch/on-screen button input (mirrors _handleKey for mobile controls) ----
  setDirection(dir, active) {
    if (dir === 'left') this.input.left = active;
    if (dir === 'right') this.input.right = active;
  }

  setJumpHeld(active) {
    if (active && !this.input.jumpHeld) this.input.jumpPressed = true;
    this.input.jumpHeld = active;
  }

  triggerEat() {
    this.input.eatPressed = true;
  }

  triggerUltimate() {
    this.input.ultimatePressed = true;
  }

  releaseAllTouchInput() {
    this.input.left = false;
    this.input.right = false;
    this.input.jumpHeld = false;
  }

  start(mapDef) {
    this.level = new Level(mapDef);
    this.level.onEat = (item, def) => this.level.spawnParticles(item, def);
    this.kirby = new Kirby(120, mapDef.groundY);
    this.camX = 0;
    this.timeLeft = mapDef.timeLimit;
    this.elapsed = 0;
    this.status = 'playing';
    this.lastTs = null;
  }

  pause() { if (this.status === 'playing') this.status = 'paused'; }
  resume() { if (this.status === 'paused') { this.status = 'playing'; this.lastTs = null; } }

  loop(ts) {
    if (this.lastTs === null) this.lastTs = ts;
    let dt = (ts - this.lastTs) / 1000;
    dt = Math.min(dt, 1 / 30);
    this.lastTs = ts;

    if (this.status === 'playing') {
      this.update(dt);
    }
    this.render();
  }

  update(dt) {
    // keep the level built out ahead of where the camera is about to scroll
    this.level.ensureGenerated(this.camX + this.width + 1200);

    this.kirby.update(dt, this.input, this.level);
    if (this.input.eatPressed) {
      this.kirby.startEat();
    }
    if (this.input.ultimatePressed) {
      this.kirby.useUltimate(this.level);
    }
    this.input.jumpPressed = false;
    this.input.eatPressed = false;
    this.input.ultimatePressed = false;

    this.level.updateParticles(dt);

    // camera follows kirby; only the left edge is bounded, the level itself never ends
    const targetCam = this.kirby.x - this.width * 0.4;
    this.camX += (targetCam - this.camX) * Math.min(1, dt * 6);
    this.camX = Math.max(0, this.camX);

    if (this.kirby.dead) {
      this.status = 'over';
      this.callbacks.onGameOver && this.callbacks.onGameOver(this.buildResult('fell'));
      return;
    }

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.status = 'over';
      this.callbacks.onGameOver && this.callbacks.onGameOver(this.buildResult('time'));
      return;
    }

    this.callbacks.onTick && this.callbacks.onTick(this.buildResult());
  }

  buildResult(reason) {
    return {
      reason: reason || null,
      score: this.kirby.score,
      eaten: this.kirby.eatenCount,
      sizePct: Math.round(this.kirby.scale / 0.62 * 100),
      timeLeft: Math.max(0, this.timeLeft),
      ultimateUnlocked: this.kirby.ultimateUnlocked,
      ultimateReady: this.kirby.ultimateUnlocked && this.kirby.ultimateCooldown <= 0,
      ultimateCooldown: Math.max(0, this.kirby.ultimateCooldown),
    };
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    if (!this.level) return;

    this.level.drawBackground(ctx, this.camX, this.width, this.height);
    this.level.drawGround(ctx, this.camX, this.width);

    const t = performance.now() / 1000;
    for (const item of this.level.terrain) {
      drawTerrainItem(ctx, item, this.camX, t);
    }

    this.level.drawParticles(ctx, this.camX);
    this.kirby.draw(ctx, this.camX);
  }
}
