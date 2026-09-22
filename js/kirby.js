// Kirby player entity: movement, jump/float, eating, and size growth.
class Kirby {
  constructor(x, groundY) {
    this.x = x;
    this.y = groundY; // foot position
    this.vx = 0;
    this.vy = 0;
    this.facing = 1; // 1 = right, -1 = left
    this.onGround = true;
    this.floating = false;

    this.state = 'idle'; // idle | walk | jump | float | eat
    this.animTimer = 0;
    this.walkFrame = 0;

    this.eatTimer = 0;
    this.eatPhase = 0; // 0 none, 1 inhale, 2 chew, 3 happy
    this.eatCooldown = 0;

    this.growth = 0; // accumulated growth -> scale
    this.eatenCount = 0;
    this.score = 0;

    this.squash = 0; // landing squash animation
    this.bounce = 0;
  }

  get scale() {
    const base = 0.62;
    const grown = Math.min(this.growth, 1.4); // cap growth influence
    return base + grown * 0.55;
  }

  get reach() {
    return 46 + this.scale * 20;
  }

  get speed() {
    // grows a little slower as it gets bigger, but not punishing
    return 235 - Math.min(this.growth, 1.4) * 45;
  }

  get jumpPower() {
    return 560 - Math.min(this.growth, 1.4) * 60;
  }

  startEat() {
    if (this.eatCooldown > 0) return;
    this.eatPhase = 1;
    this.eatTimer = 0;
    this.eatCooldown = 0.45;
  }

  tryConsume(terrainList, onEat) {
    if (this.eatPhase !== 1) return;
    const mouthX = this.x + this.facing * (this.reach * 0.6);
    let consumedAny = false;
    for (const item of terrainList) {
      if (item.eaten) continue;
      const dx = item.x - mouthX;
      const dy = (item.y - 20) - (this.y - this.scale * 60);
      const dist = Math.hypot(dx, dy * 0.6);
      if (dist < this.reach) {
        item.eaten = true;
        const def = TERRAIN_TYPES[item.type];
        this.growth += def.growth;
        this.eatenCount += 1;
        this.score += def.value;
        consumedAny = true;
        if (onEat) onEat(item, def);
      }
    }
    if (consumedAny) this.eatPhase = 2;
  }

  update(dt, input, level) {
    // -------- horizontal movement --------
    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;

    const isEating = this.eatPhase > 0;
    if (!isEating || this.eatPhase >= 2) {
      this.vx = move * this.speed;
    } else {
      this.vx *= 0.7; // slow while inhaling
    }
    if (move !== 0) this.facing = move > 0 ? 1 : -1;

    this.x += this.vx * dt;
    this.x = Math.max(40, Math.min(level.width - 40, this.x));

    // -------- jump / float --------
    if (input.jumpPressed) {
      if (this.onGround) {
        this.vy = -this.jumpPower;
        this.onGround = false;
        this.floating = false;
      } else if (!this.floating) {
        this.floating = true; // start float (glide)
      }
    }

    const gravity = this.floating && input.jumpHeld ? 420 : 1400;
    this.vy += gravity * dt;
    if (this.floating && input.jumpHeld) {
      this.vy = Math.min(this.vy, 60); // gentle descent while floating
    }
    this.y += this.vy * dt;

    // -------- ground / platform collision --------
    const support = level.getSupportY(this.x, this.y, this.prevY ?? this.y);
    if (support !== null && this.vy >= 0 && this.y >= support) {
      if (!this.onGround) this.squash = 1;
      this.y = support;
      this.vy = 0;
      this.onGround = true;
      this.floating = false;
    } else {
      this.onGround = false;
    }
    this.prevY = this.y;

    // fell into a pit
    if (this.y > level.groundY + 260) {
      this.y = level.groundY;
      this.x = Math.max(80, this.x - 120);
      this.vy = 0;
      this.onGround = true;
    }

    // -------- eating state machine --------
    if (this.eatPhase > 0) {
      this.eatTimer += dt;
      if (this.eatPhase === 1 && this.eatTimer > 0.16) {
        this.tryConsume(level.terrain, level.onEat);
        if (this.eatPhase === 1) {
          // whiffed - nothing nearby
          this.eatPhase = 0;
          this.eatTimer = 0;
        } else {
          this.eatTimer = 0;
        }
      } else if (this.eatPhase === 2 && this.eatTimer > 0.22) {
        this.eatPhase = 3;
        this.eatTimer = 0;
      } else if (this.eatPhase === 3 && this.eatTimer > 0.3) {
        this.eatPhase = 0;
        this.eatTimer = 0;
      }
    }
    if (this.eatCooldown > 0) this.eatCooldown -= dt;

    // -------- animation state --------
    if (this.eatPhase > 0) {
      this.state = 'eat';
    } else if (!this.onGround) {
      this.state = this.floating ? 'float' : 'jump';
    } else if (Math.abs(this.vx) > 5) {
      this.state = 'walk';
    } else {
      this.state = 'idle';
    }

    if (this.state === 'walk') {
      this.animTimer += dt * (6 + Math.abs(this.vx) / 40);
      this.walkFrame = Math.floor(this.animTimer) % 9;
    } else {
      this.animTimer = 0;
    }

    this.squash *= Math.max(0, 1 - dt * 8);
  }

  currentFrameKey() {
    switch (this.state) {
      case 'walk':
        return `walk_${this.walkFrame}`;
      case 'jump': {
        if (this.vy < -150) return 'jump_2';
        if (this.vy > 150) return 'jump_3';
        return 'jump_1';
      }
      case 'float': {
        const idx = Math.floor(performance.now() / 140) % 3;
        return `glide_${idx}`;
      }
      case 'eat': {
        if (this.eatPhase === 1) return 'eat_1';
        if (this.eatPhase === 2) return 'eat_6';
        if (this.eatPhase === 3) return 'eat_7';
        return 'eat_0';
      }
      default:
        return 'walk_0';
    }
  }

  draw(ctx, camX) {
    const sx = this.x - camX;
    const sy = this.y + this.squash * 6;
    const squashedScale = this.scale * (1 - this.squash * 0.1);

    KirbySprites.draw(ctx, this.currentFrameKey(), sx, sy, {
      scale: squashedScale * 1.15,
      flip: this.facing < 0,
    });
  }
}
