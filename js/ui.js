// Screen/menu wiring: title, map select, HUD, pause, result.
const UI = (() => {
  let game;
  let selectedMapId = MAPS[0].id;

  const el = (id) => document.getElementById(id);
  const screens = {
    title: el('screen-title'),
    mapSelect: el('screen-map-select'),
    pause: el('screen-pause'),
    cooking: el('screen-cooking'),
    result: el('screen-result'),
  };
  const hud = el('hud');
  const touchControls = el('touch-controls');
  let heatPressed = false; // mirrors game.input.jumpHeld for the cooking minigame's own button

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
    if (pct >= 700) return 'SSS';
    if (pct >= 450) return 'SS';
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

    const monsterChip = el('hud-monster');
    monsterChip.textContent = result.canEatMonsters ? '👹 몬스터: 간식!' : '👹 몬스터: 위험!';
    monsterChip.classList.toggle('safe', result.canEatMonsters);
  }

  function showResult(result) {
    hud.classList.add('hidden');
    touchControls.classList.add('hidden');
    game.releaseAllTouchInput();
    const titles = { fell: '구멍에 빠졌다!', monster: '몬스터에게 당했다!' };
    el('result-title').textContent = titles[result.reason] || '타임 오버!';
    el('result-score').textContent = result.score;
    el('result-eaten').textContent = `${result.eaten}개`;
    el('result-size').textContent = `${result.sizePct}%`;
    el('result-rank').textContent = rankFor(result.sizePct);

    const cookingStat = el('stat-cooking-score');
    const tasteBanner = el('result-taste');
    if (result.taste) {
      cookingStat.classList.remove('hidden');
      el('result-cooking-score').textContent = `+${result.cookingScore}`;
      tasteBanner.classList.remove('hidden');
      tasteBanner.className = `taste-banner ${result.taste.cls}`;
      tasteBanner.textContent = result.taste.label;
    } else {
      cookingStat.classList.add('hidden');
      tasteBanner.classList.add('hidden');
    }
    showScreen('result');
  }

  // ---------- Time's-up cooking cutscene + heat-control minigame ----------
  const HEAT_ZONE_MIN = 55;
  const HEAT_ZONE_MAX = 82;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function tasteFor(accuracy) {
    if (accuracy >= 0.8) return { label: '⭐⭐⭐⭐⭐ 환상의 커비 요리!', cls: 'taste-5' };
    if (accuracy >= 0.6) return { label: '⭐⭐⭐⭐ 맛있게 완성!', cls: 'taste-4' };
    if (accuracy >= 0.4) return { label: '⭐⭐⭐ 그럭저럭 먹을만해요', cls: 'taste-3' };
    if (accuracy >= 0.2) return { label: '⭐⭐ 살짝 탔어요...', cls: 'taste-2' };
    return { label: '⭐ 새까맣게 타버렸다...', cls: 'taste-1' };
  }

  // Returns a promise resolving to the fraction of time (0..1) the heat was kept in the ideal zone.
  // Reads both the keyboard/mobile jump input (already wired for gameplay) and this scene's own
  // press-and-hold button, so any of Up/Space/tc-jump/cooking-heat-btn raises the heat.
  function runHeatMinigame(durationMs) {
    return new Promise((resolve) => {
      const needle = el('heat-needle');
      let heat = 20;
      let timeInZone = 0;
      let elapsedMs = 0;
      let lastTs = null;

      function frame(ts) {
        if (lastTs === null) lastTs = ts;
        const dt = Math.min((ts - lastTs) / 1000, 1 / 30);
        lastTs = ts;
        elapsedMs += dt * 1000;

        const held = game.input.jumpHeld || heatPressed;
        heat += (held ? 95 : -60) * dt;
        heat = Math.max(0, Math.min(100, heat));

        const inZone = heat >= HEAT_ZONE_MIN && heat <= HEAT_ZONE_MAX;
        if (inZone) timeInZone += dt;

        needle.style.bottom = `${heat}%`;
        needle.classList.toggle('in-zone', inZone);

        if (elapsedMs < durationMs) {
          requestAnimationFrame(frame);
        } else {
          resolve(Math.max(0, Math.min(1, timeInZone / (durationMs / 1000))));
        }
      }
      requestAnimationFrame(frame);
    });
  }

  // Waits for the player to drag a diagonal "slash" across the board scene. Draws the drag as a
  // glowing trail on a canvas overlaid on the photo; a swipe that's too short or too close to
  // horizontal/vertical is rejected (with a hint) rather than accepted as a "cut".
  function runSliceGesture() {
    return new Promise((resolve) => {
      const canvas = el('slice-canvas');
      const hint = el('cooking-caption');
      const ctx = canvas.getContext('2d');
      canvas.classList.remove('hidden');

      function resize() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }
      resize();
      window.addEventListener('resize', resize);

      let dragging = false;
      let startX = 0, startY = 0, lastX = 0, lastY = 0;

      function clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

      function drawSegment(x1, y1, x2, y2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(255,255,255,0.9)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      function pointFromEvent(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }

      function onDown(e) {
        dragging = true;
        clear();
        const p = pointFromEvent(e);
        startX = lastX = p.x;
        startY = lastY = p.y;
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore - up/cancel still fire */ }
      }

      function onMove(e) {
        if (!dragging) return;
        const p = pointFromEvent(e);
        drawSegment(lastX, lastY, p.x, p.y);
        lastX = p.x;
        lastY = p.y;
      }

      function onUp() {
        if (!dragging) return;
        dragging = false;
        const dx = lastX - startX;
        const dy = lastY - startY;
        const dist = Math.hypot(dx, dy);
        let angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
        if (angle > 90) angle = 180 - angle;
        const minDist = Math.min(canvas.width, canvas.height) * 0.3;
        const isDiagonal = angle > 25 && angle < 65;

        if (dist >= minDist && isDiagonal) {
          cleanup();
          resolve();
        } else {
          clear();
          hint.textContent = '더 길게, 사선(↗ 또는 ↘) 방향으로 쓱 밀어보세요!';
        }
      }

      function cleanup() {
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
        window.removeEventListener('resize', resize);
        canvas.classList.add('hidden');
      }

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
    });
  }

  async function runCookingScenes(baseResult) {
    const img = el('cooking-image');
    const caption = el('cooking-caption');
    const stage = el('cooking-image').parentElement;
    const flash = el('slice-flash-overlay');
    const heatControls = el('cooking-heat-controls');
    heatControls.classList.add('hidden');

    img.src = 'assets/cooking/board.jpg';
    caption.textContent = '앗, 시간 종료! 화면을 사선으로 쓱 밀어서 커비를 썰어보세요!';
    await runSliceGesture();

    flash.classList.add('active');
    stage.classList.add('shake');
    await wait(160);
    flash.classList.remove('active');
    stage.classList.remove('shake');

    img.src = 'assets/cooking/diced.jpg';
    caption.textContent = '숭덩숭덩... 먹기 좋은 크기로 썰렸다!';
    await wait(1200);

    img.src = 'assets/cooking/pan.jpg';
    caption.textContent = '불 조절이 맛을 좌우한다! 초록 구간을 유지하세요';
    heatControls.classList.remove('hidden');
    const accuracy = await runHeatMinigame(9000);
    heatControls.classList.add('hidden');

    const taste = tasteFor(accuracy);
    img.src = 'assets/cooking/plate.jpg';
    caption.textContent = `완성! ${taste.label}`;
    await wait(700);

    const cookingScore = Math.round(accuracy * 300);
    showResult({
      ...baseResult,
      score: baseResult.score + cookingScore,
      cookingScore,
      cookingAccuracy: accuracy,
      taste,
    });
  }

  function startCookingSequence(result) {
    hud.classList.add('hidden');
    touchControls.classList.add('hidden');
    game.releaseAllTouchInput();
    heatPressed = false;
    showScreen('cooking');
    runCookingScenes(result);
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
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* unsupported/invalid pointer - the up/cancel/leave listeners still cover release */ }
      onDown();
    });
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
    bindHold('cooking-heat-btn', () => { heatPressed = true; }, () => { heatPressed = false; });
  }

  function init(gameInstance) {
    game = gameInstance;
    game.callbacks.onTick = updateHud;
    game.callbacks.onGameOver = showResult;
    game.callbacks.onTimeUp = startCookingSequence;
    game.callbacks.onPauseRequest = () => { game.pause(); showScreen('pause'); };
    detectTouch();
    bind();
    bindTouchControls();
    buildMapList();
    showScreen('title');
  }

  return { init };
})();
