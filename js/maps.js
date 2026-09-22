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

// Builds a repeating field of terrain items along the ground, skipping pit ranges.
function scatterTerrain(list, groundY, startX, endX, step, pattern, pits) {
  let i = 0;
  for (let x = startX; x < endX; x += step) {
    const inPit = pits.some((p) => x > p[0] - 20 && x < p[1] + 20);
    if (inPit) { i++; continue; }
    const type = pattern[i % pattern.length];
    list.push(makeTerrain(type, x + (Math.sin(i * 12.9898) * 14), groundY));
    i++;
  }
}

const MAPS = [
  {
    id: 'green-field',
    name: '그린 필드',
    desc: '초보자를 위한 평화로운 초원',
    theme: { sky: ['#bfe8ff', '#eaf9ff'], ground: '#8fd66d', groundDark: '#5fae4d', accent: '#ffe27a' },
    levelWidth: 3200,
    groundY: 420,
    timeLimit: 60,
    pits: [[1500, 1580]],
    platforms: [
      { x: 1850, y: 330, w: 160 },
    ],
    build(groundY) {
      const list = [];
      scatterTerrain(list, groundY, 300, this.levelWidth - 200, 130,
        ['grass', 'grass', 'bush', 'grass', 'mushroom', 'grass', 'bush'], this.pits);
      list.push(makeTerrain('crystal', 900, groundY));
      list.push(makeTerrain('crystal', 2600, groundY));
      list.push(makeTerrain('tree', 1900, 330));
      return list;
    },
  },
  {
    id: 'forest-hill',
    name: '포레스트 힐',
    desc: '나무가 우거진 언덕, 플랫폼 점프 주의',
    theme: { sky: ['#bfe0c8', '#eaf7ec'], ground: '#6fae5c', groundDark: '#437a37', accent: '#ffd36e' },
    levelWidth: 3800,
    groundY: 430,
    timeLimit: 55,
    pits: [[1100, 1190], [2300, 2400]],
    platforms: [
      { x: 1000, y: 330, w: 150 },
      { x: 1300, y: 300, w: 150 },
      { x: 2200, y: 340, w: 140 },
      { x: 2500, y: 300, w: 150 },
    ],
    build(groundY) {
      const list = [];
      scatterTerrain(list, groundY, 260, this.levelWidth - 200, 115,
        ['bush', 'tree', 'grass', 'mushroom', 'bush', 'tree', 'grass'], this.pits);
      list.push(makeTerrain('crystal', 1050, 330));
      list.push(makeTerrain('crystal', 1350, 300));
      list.push(makeTerrain('crystal', 3200, groundY));
      list.push(makeTerrain('tree', 2550, 300));
      return list;
    },
  },
  {
    id: 'rocky-canyon',
    name: '락키 캐년',
    desc: '험난한 협곡, 시간은 짧고 보석은 많다',
    theme: { sky: ['#e7cfae', '#fbe9d0'], ground: '#c9a06b', groundDark: '#9a7548', accent: '#ff9a6b' },
    levelWidth: 4200,
    groundY: 440,
    timeLimit: 50,
    pits: [[900, 990], [1700, 1810], [2600, 2680], [3300, 3400]],
    platforms: [
      { x: 850, y: 350, w: 130 },
      { x: 1650, y: 330, w: 140 },
      { x: 1800, y: 360, w: 120 },
      { x: 2550, y: 340, w: 140 },
      { x: 3250, y: 320, w: 150 },
    ],
    build(groundY) {
      const list = [];
      scatterTerrain(list, groundY, 250, this.levelWidth - 200, 110,
        ['rock', 'mushroom', 'rock', 'grass', 'rock', 'bush'], this.pits);
      list.push(makeTerrain('crystal', 950, 350));
      list.push(makeTerrain('crystal', 1750, 330));
      list.push(makeTerrain('crystal', 2620, 340));
      list.push(makeTerrain('crystal', 3350, 320));
      list.push(makeTerrain('crystal', 4000, groundY));
      list.push(makeTerrain('tree', 2100, groundY));
      return list;
    },
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
