// Terrain type definitions + map layouts.
const TERRAIN_TYPES = {
  grass:    { label: '들풀',   value: 5,  growth: 0.010, radius: 26, color: '#7bc96f', dark: '#57a34a' },
  bush:     { label: '덤불',   value: 10, growth: 0.018, radius: 30, color: '#5fae55', dark: '#3f8a38' },
  mushroom: { label: '버섯',   value: 15, growth: 0.024, radius: 28, color: '#e6595f', dark: '#b8383f' },
  rock:     { label: '돌멩이', value: 20, growth: 0.030, radius: 30, color: '#a6a6ad', dark: '#7d7d84' },
  tree:     { label: '나무',   value: 35, growth: 0.050, radius: 40, color: '#4c9a4c', dark: '#2f6e30' },
  crystal:  { label: '보석',   value: 60, growth: 0.075, radius: 26, color: '#7fd8ff', dark: '#3fa8de' },
};

function makeTerrain(type, x, groundY) {
  return {
    type,
    x,
    y: groundY,
    eaten: false,
    bobSeed: Math.random() * Math.PI * 2,
  };
}

// Monsters: a hazard while Kirby is small, food once he's grown past MONSTER_EAT_GROWTH (kirby.js).
const MONSTER_TYPES = {
  spike: { label: '스파이크', value: 40, growth: 0.060, radius: 24, color: '#8a5fd6', dark: '#5a3a94', speed: 75, range: 100 },
  grump: { label: '그럼피',   value: 70, growth: 0.100, radius: 32, color: '#e0574a', dark: '#9c342a', speed: 48, range: 140 },
};

function makeMonster(type, x, groundY) {
  return {
    type,
    x,
    baseX: x,
    y: groundY,
    dir: Math.random() < 0.5 ? -1 : 1,
    alive: true,
    bobSeed: Math.random() * Math.PI * 2,
  };
}

function weightedPick(weights) {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of weights) {
    r -= w;
    if (r <= 0) return type;
  }
  return weights[0][0];
}

// Generates one chunk's worth of ground pit(s), platforms and scattered terrain.
// Called on demand as the camera advances, so the level never runs out - it just keeps building ahead.
function generateChunk(mapDef, index) {
  const startX = index * mapDef.chunkWidth;
  const endX = startX + mapDef.chunkWidth;
  const groundY = mapDef.groundY;
  const pits = [];
  const platforms = [];
  const terrain = [];
  const monsters = [];

  let pitRange = null;
  if (index >= 2 && Math.random() < mapDef.pitChance) {
    const pitWidth = 80 + Math.random() * 60;
    const pitStart = startX + 160 + Math.random() * Math.max(40, mapDef.chunkWidth - 320 - pitWidth);
    pitRange = [pitStart, pitStart + pitWidth];
    pits.push(pitRange);
    if (Math.random() < 0.5) {
      platforms.push({ x: pitStart - 20, y: groundY - (100 + Math.random() * 70), w: pitWidth + 40 });
    }
  }

  const inPit = (x) => pitRange && x > pitRange[0] - 25 && x < pitRange[1] + 25;

  for (let x = startX + 30; x < endX; x += mapDef.terrainStep * (0.65 + Math.random() * 0.7)) {
    if (inPit(x)) continue;
    const type = weightedPick(mapDef.terrainWeights);
    terrain.push(makeTerrain(type, x, groundY));
  }

  // occasional floating decoration on platforms
  for (const p of platforms) {
    if (Math.random() < 0.7) terrain.push(makeTerrain('crystal', p.x + p.w / 2, p.y));
  }

  // Monsters spawn from the very first chunk (unlike pits, which wait a couple of chunks for a
  // safe start) and roll twice per chunk, so they show up early and often rather than trickling in.
  const monsterMinOffset = index === 0 ? 320 : 80; // keep the first ~320px clear so it's not an instant hit
  for (let attempt = 0; attempt < 2; attempt++) {
    if (Math.random() >= mapDef.monsterChance) continue;
    let mx;
    let tries = 0;
    do {
      mx = startX + monsterMinOffset + Math.random() * Math.max(40, mapDef.chunkWidth - monsterMinOffset - 40);
      tries++;
    } while (inPit(mx) && tries < 6);
    if (!inPit(mx)) {
      const type = weightedPick(mapDef.monsterWeights);
      monsters.push(makeMonster(type, mx, groundY));
    }
  }

  return { pits, platforms, terrain, monsters };
}

const MAPS = [
  {
    id: 'green-field',
    name: '그린 필드',
    desc: '초보자를 위한 평화로운 무한 초원',
    theme: { sky: ['#bfe8ff', '#eaf9ff'], ground: '#8fd66d', groundDark: '#5fae4d', accent: '#ffe27a' },
    groundY: 420,
    timeLimit: 60,
    chunkWidth: 900,
    terrainStep: 72,
    pitChance: 0.3,
    terrainWeights: [['grass', 5], ['bush', 3], ['mushroom', 2], ['tree', 1], ['crystal', 1]],
    monsterChance: 0.35,
    monsterWeights: [['spike', 3], ['grump', 1]],
  },
  {
    id: 'forest-hill',
    name: '포레스트 힐',
    desc: '나무가 우거진 언덕, 플랫폼 점프 주의',
    theme: { sky: ['#bfe0c8', '#eaf7ec'], ground: '#6fae5c', groundDark: '#437a37', accent: '#ffd36e' },
    groundY: 430,
    timeLimit: 55,
    chunkWidth: 850,
    terrainStep: 66,
    pitChance: 0.42,
    terrainWeights: [['bush', 4], ['tree', 3], ['grass', 3], ['mushroom', 2], ['crystal', 1]],
    monsterChance: 0.42,
    monsterWeights: [['spike', 2], ['grump', 2]],
  },
  {
    id: 'rocky-canyon',
    name: '락키 캐년',
    desc: '험난한 협곡, 시간은 짧고 보석은 많다',
    theme: { sky: ['#e7cfae', '#fbe9d0'], ground: '#c9a06b', groundDark: '#9a7548', accent: '#ff9a6b' },
    groundY: 440,
    timeLimit: 50,
    chunkWidth: 820,
    terrainStep: 62,
    pitChance: 0.52,
    terrainWeights: [['rock', 4], ['mushroom', 2], ['grass', 2], ['bush', 2], ['tree', 1], ['crystal', 1]],
    monsterChance: 0.5,
    monsterWeights: [['spike', 2], ['grump', 3]],
  },
];

function getMapById(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

// ---- Terrain drawing (procedural canvas shapes, no extra image assets needed) ----
function drawTerrainItem(ctx, item, camX, t) {
  if (item.eaten) return;
  const def = TERRAIN_TYPES[item.type];
  const sx = item.x - camX;
  if (sx < -80 || sx > 1100) return;
  const bob = Math.sin(t * 2 + item.bobSeed) * 2;
  const sy = item.y + bob;

  ctx.save();
  ctx.translate(sx, sy);

  switch (item.type) {
    case 'grass': {
      ctx.strokeStyle = def.dark;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 6, 0);
        ctx.quadraticCurveTo(i * 10, -14, i * 4, -24 - Math.abs(i) * 2);
        ctx.strokeStyle = def.color;
        ctx.stroke();
      }
      break;
    }
    case 'bush': {
      ctx.fillStyle = def.dark;
      ctx.beginPath(); ctx.ellipse(0, -6, 26, 16, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = def.color;
      [[-14, -12, 15], [0, -20, 18], [14, -12, 15]].forEach(([bx, by, r]) => {
        ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
    case 'mushroom': {
      ctx.fillStyle = '#f4e9d8';
      ctx.fillRect(-5, -18, 10, 18);
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.ellipse(0, -20, 20, 14, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#fff';
      [[-9, -24], [6, -27], [0, -18]].forEach(([dx, dy]) => {
        ctx.beginPath(); ctx.arc(dx, dy, 3, 0, Math.PI * 2); ctx.fill();
      });
      break;
    }
    case 'rock': {
      ctx.fillStyle = def.dark;
      ctx.beginPath();
      ctx.moveTo(-22, 0); ctx.lineTo(-16, -22); ctx.lineTo(4, -28);
      ctx.lineTo(22, -12); ctx.lineTo(18, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(-18, -2); ctx.lineTo(-12, -20); ctx.lineTo(3, -25);
      ctx.lineTo(18, -10); ctx.lineTo(15, 0); ctx.closePath(); ctx.fill();
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#8a5a34';
      ctx.fillRect(-7, -20, 14, 22);
      ctx.fillStyle = def.dark;
      ctx.beginPath(); ctx.arc(0, -46, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(-10, -52, 26, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -50, 24, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2, -66, 22, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'crystal': {
      ctx.fillStyle = def.dark;
      ctx.beginPath();
      ctx.moveTo(0, -34); ctx.lineTo(14, -14); ctx.lineTo(0, 2); ctx.lineTo(-14, -14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.moveTo(0, -30); ctx.lineTo(10, -14); ctx.lineTo(0, -2); ctx.lineTo(-10, -14);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(4, -18); ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ---- Monster drawing (procedural canvas shapes) ----
function drawMonster(ctx, m, camX, t, canEat) {
  if (!m.alive) return;
  const def = MONSTER_TYPES[m.type];
  const sx = m.x - camX;
  if (sx < -80 || sx > 1100) return;
  const bob = Math.sin(t * 4 + m.bobSeed) * 3;
  const sy = m.y + bob;
  const flip = m.dir < 0;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(flip ? -1 : 1, 1);
  if (canEat) { ctx.globalAlpha = 0.55; } // telegraph that it's now safe/edible rather than a threat

  switch (m.type) {
    case 'spike': {
      const r = def.radius;
      ctx.fillStyle = def.dark;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const sr = i % 2 === 0 ? r + 10 : r - 2;
        const px = Math.cos(a) * sr;
        const py = -r + Math.sin(a) * sr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(0, -r, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-7, -r - 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, -r - 3, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1f3d';
      ctx.beginPath(); ctx.arc(-7, -r - 1, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, -r - 1, 2.4, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'grump': {
      const r = def.radius;
      ctx.fillStyle = def.dark;
      ctx.beginPath(); ctx.ellipse(0, -r + 4, r + 4, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.ellipse(0, -r + 6, r, r - 4, 0, 0, Math.PI * 2); ctx.fill();
      // angry eyebrows
      ctx.strokeStyle = '#3a1410';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.6, -r - 2); ctx.lineTo(-r * 0.1, -r + 6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.6, -r - 2); ctx.lineTo(r * 0.1, -r + 6); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * 0.35, -r + 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.35, -r + 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1f3d';
      ctx.beginPath(); ctx.arc(-r * 0.35, -r + 9, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.35, -r + 9, 2.6, 0, Math.PI * 2); ctx.fill();
      // fangs
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(-6, -r + 16); ctx.lineTo(-2, -r + 16); ctx.lineTo(-4, -r + 24); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -r + 16); ctx.lineTo(2, -r + 16); ctx.lineTo(4, -r + 24); ctx.closePath(); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
