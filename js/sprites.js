// Loads the Kirby sprite atlas (image + frame metadata) and exposes a draw helper.
const KirbySprites = (() => {
  let image = null;
  let atlas = null;
  let ready = false;

  function load() {
    return Promise.all([
      fetch('assets/kirby-atlas.json').then((r) => r.json()),
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = 'assets/kirby-atlas.png';
      }),
    ]).then(([json, img]) => {
      atlas = json;
      image = img;
      ready = true;
    });
  }

  function frame(key) {
    return atlas ? atlas.frames[key] : null;
  }

  function groupFrames(name) {
    return atlas && atlas.groups[name] ? atlas.groups[name] : [];
  }

  // Draws a frame centered horizontally at (x, y) with y as the FOOT baseline.
  function draw(ctx, key, x, y, opts = {}) {
    if (!ready) return;
    const f = frame(key);
    if (!f) return;
    const scale = opts.scale || 1;
    const flip = !!opts.flip;
    const w = f.w * scale;
    const h = f.h * scale;

    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(image, f.x, f.y, f.w, f.h, -w / 2, -h, w, h);
    ctx.restore();
  }

  return { load, frame, groupFrames, draw, get isReady() { return ready; } };
})();
