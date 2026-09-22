// Screen/menu wiring: title, map select, HUD, pause, result.
const UI = (() => {
  let game;
  let selectedMapId = MAPS[0].id;

  const el = (id) => document.getElementById(id);
  const screens = {
    title: el('screen-title'),
    mapSelect: el('screen-map-select'),
    pause: el('screen-pause'),
    result: el('screen-result'),
  };
  const hud = el('hud');

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    if (name && screens[name]) screens[name].classList.add('active');
  }

  function buildMapList() {
    const wrap = el('map-list');
    wrap.innerHTML = '';
    MAPS.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'map-card' + (m.id === selectedMapId ? ' selected' : '');
      card.innerHTML = `
        <div class="map-thumb" style="background:linear-gradient(180deg, ${m.theme.sky[0]}, ${m.theme.ground})"></div>
        <h3>${m.name}</h3>
        <p>${m.desc}</p>
        <div class="map-meta"><span>⏱ ${m.timeLimit}초</span><span>🍽 ${m.build(m.groundY).length}개 지형</span></div>
      `;
      card.addEventListener('click', () => {
        selectedMapId = m.id;
        buildMapList();
        launchGame();
      });
      wrap.appendChild(card);
    });
  }

  function launchGame() {
    const mapDef = getMapById(selectedMapId);
    game.start(mapDef);
    hud.classList.remove('hidden');
    showScreen(null);
  }

  function rankFor(pct) {
    if (pct >= 260) return 'S';
    if (pct >= 210) return 'A';
    if (pct >= 170) return 'B';
    if (pct >= 130) return 'C';
    return 'D';
  }

  function updateHud(result) {
    el('hud-time').textContent = Math.ceil(result.timeLeft);
    el('hud-score').textContent = result.score;
    el('hud-size').textContent = `${result.sizePct}%`;
    const pct = Math.min(100, ((result.sizePct - 100) / 200) * 100);
    el('size-bar-fill').style.width = `${Math.max(4, pct)}%`;
  }

  function showResult(result) {
    hud.classList.add('hidden');
    el('result-score').textContent = result.score;
    el('result-eaten').textContent = `${result.eaten} / ${result.totalTerrain}개`;
    el('result-size').textContent = `${result.sizePct}%`;
    el('result-rank').textContent = rankFor(result.sizePct);
    showScreen('result');
  }

  function bind() {
    el('btn-play').addEventListener('click', launchGame);
    el('btn-select-map').addEventListener('click', () => { buildMapList(); showScreen('mapSelect'); });
    el('btn-back-from-map').addEventListener('click', () => showScreen('title'));

    el('btn-pause').addEventListener('click', () => { game.pause(); showScreen('pause'); });
    el('btn-resume').addEventListener('click', () => { game.resume(); showScreen(null); });
    el('btn-pause-restart').addEventListener('click', () => { launchGame(); });
    el('btn-pause-title').addEventListener('click', () => { hud.classList.add('hidden'); showScreen('title'); });

    el('btn-retry').addEventListener('click', () => launchGame());
    el('btn-result-map').addEventListener('click', () => { buildMapList(); showScreen('mapSelect'); });
    el('btn-result-title').addEventListener('click', () => showScreen('title'));
  }

  function init(gameInstance) {
    game = gameInstance;
    game.callbacks.onTick = updateHud;
    game.callbacks.onGameOver = showResult;
    game.callbacks.onPauseRequest = () => { game.pause(); showScreen('pause'); };
    bind();
    buildMapList();
    showScreen('title');
  }

  return { init };
})();
