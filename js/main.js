(function () {
  const canvas = document.getElementById('game-canvas');
  const game = new Game(canvas);

  function loop(ts) {
    game.loop(ts);
    requestAnimationFrame(loop);
  }

  KirbySprites.load()
    .then(() => {
      UI.init(game);
      requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error('Failed to load Kirby sprites', err);
      document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">스프라이트를 불러오지 못했습니다. assets/kirby-atlas.png 파일을 확인해주세요.</p>';
    });
})();
