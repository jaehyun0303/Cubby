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
  const touchControls = el('touch-controls');

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
        <div class="map-meta"><span>⏱ ${m.timeLimit}초</span><span>🕳 구멍 확률 ${Math.round(m.pitChance * 100)}%</span></div>
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
    touchControls.classList.remove('hidden');
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

    const ult = el('hud-ultimate');
    const tcUlt = el('tc-ultimate');
    if (!result.ultimateUnlocked) {
      ult.textContent = '🔒 궁극기 잠김';
      ult.classList.remove('ready');
      tcUlt.classList.remove('ready');
      tcUlt.classList.add('locked');
    } else if (result.ultimateReady) {
      ult.textContent = '⚡ 궁극기 준비!';
      ult.classList.add('ready');
      tcUlt.classList.add('ready');
      tcUlt.classList.remove('locked');
    } else {
      ult.textContent = `⏳ 궁극기 ${Math.ceil(result.ultimateCooldown)}s`;
      ult.classList.remove('ready');
      tcUlt.classList.remove('ready', 'locked');
    }
  }

  function showResult(result) {
    hud.classList.add('hidden');
    touchControls.classList.add('hidden');
    game.releaseAllTouchInput();
    el('result-title').textContent = result.reason === 'fell' ? '구멍에 빠졌다!' : '타임 오버!';
    el('result-score').textContent = result.score;
    el('result-eaten').textContent = `${result.eaten}개`;
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
    el('btn-pause-title').addEventListener('click', () => {
      hud.classList.add('hidden');
      touchControls.classList.add('hidden');
      game.releaseAllTouchInput();
      showScreen('title');
    });

    el('btn-retry').addEventListener('click', () => launchGame());
    el('btn-result-map').addEventListener('click', () => { buildMapList(); showScreen('mapSelect'); });
    el('btn-result-title').addEventListener('click', () => showScreen('title'));
  }

  // Detect touch-capable devices so the on-screen buttons only show up where needed.
  function detectTouch() {
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (isTouch) document.body.classList.add('is-touch');
  }

  // Pointer Events cover touch + mouse/stylus uniformly, so this also works for quick testing with a mouse.
  function bindHold(btnId, onDown, onUp) {
    const btn = el(btnId);
    const release = () => onUp();
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); btn.setPointerCapture(e.pointerId); onDown(); });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }

  function bindTouchControls() {
    // Each button captures its own pointer (see bindHold), so release/cancel/leave fire
    // reliably per-finger even if it slides outside the button - safe for multi-touch
    // (e.g. holding left + jump with two fingers at once) without a global reset.
    bindHold('tc-left', () => game.setDirection('left', true), () => game.setDirection('left', false));
    bindHold('tc-right', () => game.setDirection('right', true), () => game.setDirection('right', false));
    bindHold('tc-jump', () => game.setJumpHeld(true), () => game.setJumpHeld(false));
    el('tc-eat').addEventListener('pointerdown', (e) => { e.preventDefault(); game.triggerEat(); });
    el('tc-ultimate').addEventListener('pointerdown', (e) => { e.preventDefault(); game.triggerUltimate(); });
  }

  function init(gameInstance) {
    game = gameInstance;
    game.callbacks.onTick = updateHud;
    game.callbacks.onGameOver = showResult;
    game.callbacks.onPauseRequest = () => { game.pause(); showScreen('pause'); };
    detectTouch();
    bind();
    bindTouchControls();
    buildMapList();
    showScreen('title');
  }

  return { init };
})();
