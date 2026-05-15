// Pixel starfield background — breathing static field of +/x/diamond/burst
// sprites, ambient pixelated shooting stars, cursor-proximity glow, and
// click / hold-drag star spawning. No build step, no dependencies.
(() => {
  const canvas = document.getElementById('sky');
  const ctx = canvas.getContext('2d');

  // Respect the visitor's OS reduced-motion preference. With it on, the
  // starfield stays but goes still: no twinkle, no breathing/respawn, no
  // shooting stars, no click/drag spawning — just a calm static sky.
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  motionQuery.addEventListener('change', e => { reduced = e.matches; });

  const PIX = 4;                       // chunky "pixel" block size
  const snap = v => Math.round(v / PIX) * PIX;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  // tints for shooting-star trails; heads are near-white
  const TINTS = ['#00f5d4', '#b44fff', '#7fd8ff'];
  const HEAD = '#f4f0ff';

  // Every star kind is a pixel-art sprite (bitmap rows, '#' = filled cell).
  // Plain blocks render on the coarse 4px grid; detailed shapes on a finer 2px
  // sub-grid so '+', 'x', diamond and burst all carry real definition.
  const SHAPES = {
    dot:     { cell: 4, rows: ["#"] },
    big:     { cell: 4, rows: ["##",
                               "##"] },
    plus:    { cell: 2, rows: ["..#..",
                               "..#..",
                               "#####",
                               "..#..",
                               "..#.."] },
    x:       { cell: 2, rows: ["#...#",
                               ".#.#.",
                               "..#..",
                               ".#.#.",
                               "#...#"] },
    diamond: { cell: 2, rows: ["...#...",
                               "...#...",
                               "..###..",
                               "#######",
                               "..###..",
                               "...#...",
                               "...#..."] },
    burst:   { cell: 2, rows: ["...#...",
                               ".#.#.#.",
                               "..###..",
                               "###.###",
                               "..###..",
                               ".#.#.#.",
                               "...#..."] },
  };
  // Pre-render every shape x colour to a tiny offscreen canvas once, so the
  // per-frame static field costs one drawImage per star instead of N fillRects.
  const STAR_COLORS = ['#e8e4f5', '#d9ccff', '#ffffff'];
  const SPRITE_CACHE = {};
  function buildSpriteCache() {
    for (const kind in SHAPES) {
      const { cell, rows } = SHAPES[kind];
      const w = rows[0].length * cell, h = rows.length * cell;
      for (const color of STAR_COLORS) {
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cc = cv.getContext('2d');
        cc.fillStyle = color;
        for (let r = 0; r < rows.length; r++)
          for (let c = 0; c < rows[r].length; c++)
            if (rows[r][c] === '#') cc.fillRect(c * cell, r * cell, cell, cell);
        SPRITE_CACHE[kind + '|' + color] = {
          cv, ox: (rows[0].length >> 1) * cell, oy: (rows.length >> 1) * cell,
        };
      }
    }
  }

  let W, H, staticStars = [], shooters = [], mx = -1, my = -1;
  // shipped tuning (the "normal" preset): chill star speed, normal frequency + density
  const mode = { gapMin: 850, gapMax: 2300, starDiv: 12000, spdMin: 2.5, spdMax: 5 };
  let nextSpawn = 0;

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    ctx.imageSmoothingEnabled = false;
    buildStaticStars();
  }
  // (re)roll a static star in place: new spot, shape, brightness, and lifespan
  function respawnStar(s, now) {
    const r = Math.random();
    // mostly plain dots; a sprinkle of bigger blocks, +, x, and the diamond/burst sparkles
    s.kind = r < 0.58 ? 'dot'
           : r < 0.76 ? 'big'
           : r < 0.84 ? 'plus'
           : r < 0.92 ? 'x'
           : r < 0.96 ? 'diamond'
           : 'burst';
    s.x = snap(rand(0, W));
    s.y = snap(rand(0, H));
    s.base = (s.kind === 'diamond' || s.kind === 'burst') ? rand(0.20, 0.40)
           : (s.kind === 'plus' || s.kind === 'x') ? rand(0.14, 0.34)
           : rand(0.05, 0.30);
    s.phase = rand(0, Math.PI * 2);
    s.life = rand(8000, 20000);   // ms a star lives before it fades out + respawns
    s.born = now;
  }
  function buildStaticStars() {
    const n = Math.min(320, Math.round((W * H) / mode.starDiv));
    const t = performance.now();
    staticStars = [];
    for (let i = 0; i < n; i++) {
      const s = {};
      respawnStar(s, t);
      s.born = t - rand(0, s.life);   // stagger initial ages so they don't all breathe in sync
      staticStars.push(s);
    }
  }
  function spawnShooter() {
    const dir = Math.random() < 0.5 ? -1 : 1;        // travel left or right
    const speed = rand(mode.spdMin, mode.spdMax);
    const ang = rand(16, 46) * Math.PI / 180;        // degrees below horizontal
    const x = dir > 0 ? rand(-120, W * 0.55) : rand(W * 0.45, W + 120);
    const y = rand(-120, H * 0.42);
    shooters.push({
      x, y,
      vx: dir * speed * Math.cos(ang),
      vy: speed * Math.sin(ang),
      trail: [],
      maxTrail: (rand(11, 20) | 0),
      tint: pick(TINTS),
    });
  }
  // click/tap (or hold-drag) spawns a star at the pointer.
  // with a movement hint (hx,hy) it streaks roughly along the drag; else random.
  function spawnShooterAt(px, py, hx, hy) {
    if (reduced || shooters.length > 240) return;   // off under reduced motion; soft cap vs flood
    const speed = rand(mode.spdMin, mode.spdMax) * 1.2;
    const theta = (hx || hy) ? Math.atan2(hy, hx) + rand(-0.5, 0.5) : rand(0, Math.PI * 2);
    shooters.push({
      x: px, y: py,
      vx: speed * Math.cos(theta),
      vy: speed * Math.sin(theta),
      trail: [],
      maxTrail: (rand(12, 22) | 0),
      tint: pick(TINTS),
    });
  }
  function step(now) {
    ctx.clearRect(0, 0, W, H);

    // static field — stars breathe (slow fade in/out then respawn) + light up near the pointer
    const R = 130, R2 = R * R, FADE = 1800;
    for (const s of staticStars) {
      // breathing lifecycle only runs with motion enabled
      let env = 1;
      if (!reduced) {
        let age = now - s.born;
        if (age > s.life) { respawnStar(s, now); age = 0; }
        // envelope: fade in over FADE ms, hold, fade out over FADE ms, then respawn
        if (age < FADE) env = age / FADE;
        else if (age > s.life - FADE) env = Math.max(0, (s.life - age) / FADE);
      }
      let a = (reduced ? s.base : s.base * (0.55 + 0.45 * Math.sin(now / 900 + s.phase))) * env;
      let bright = false;
      if (mx >= 0) {
        const dx = s.x - mx, dy = s.y - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          const prox = 1 - Math.sqrt(d2) / R;     // 0 at edge -> 1 at pointer
          a = Math.min(1, a + prox * 0.9 * env);
          bright = prox > 0.45 && env > 0.5;
        }
      }
      const color = bright ? '#ffffff'
        : (s.kind === 'dot' || s.kind === 'big') ? '#e8e4f5' : '#d9ccff';
      const spr = SPRITE_CACHE[s.kind + '|' + color];
      ctx.globalAlpha = a;
      ctx.drawImage(spr.cv, s.x - spr.ox, s.y - spr.oy);
    }
    ctx.globalAlpha = 1;

    if (!reduced) {
      // ambient shooting stars
      if (now > nextSpawn) {
        spawnShooter();
        nextSpawn = now + rand(mode.gapMin, mode.gapMax);
      }
      for (let i = shooters.length - 1; i >= 0; i--) {
        const sh = shooters[i];
        sh.trail.push({ x: snap(sh.x), y: snap(sh.y) });
        if (sh.trail.length > sh.maxTrail) sh.trail.shift();
        sh.x += sh.vx;
        sh.y += sh.vy;

        for (let t = 0; t < sh.trail.length; t++) {
          const f = t / sh.trail.length;            // 0 oldest -> 1 newest
          ctx.globalAlpha = f * f * 0.95;
          ctx.fillStyle = t >= sh.trail.length - 2 ? HEAD : sh.tint;
          const p = sh.trail[t];
          ctx.fillRect(p.x, p.y, PIX, PIX);
        }
        // bright head
        ctx.globalAlpha = 1;
        ctx.fillStyle = HEAD;
        ctx.fillRect(snap(sh.x), snap(sh.y), PIX, PIX);

        if (sh.x < -160 || sh.x > W + 160 || sh.y < -160 || sh.y > H + 160) shooters.splice(i, 1);
      }
      ctx.globalAlpha = 1;
    }
    requestAnimationFrame(step);
  }

  // pointer interaction: cursor-proximity glow + click / hold-drag to spawn stars
  let dragging = false, lastSpawnX = 0, lastSpawnY = 0;
  addEventListener('resize', resize);
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (dragging) {
      const dx = e.clientX - lastSpawnX, dy = e.clientY - lastSpawnY;
      if (dx * dx + dy * dy > 22 * 22) {          // hold + drag: spawn every ~22px of travel
        spawnShooterAt(e.clientX, e.clientY, dx, dy);
        lastSpawnX = e.clientX; lastSpawnY = e.clientY;
      }
    }
  });
  document.addEventListener('mouseleave', () => { mx = my = -1; });
  addEventListener('pointerdown', e => {
    dragging = true;
    lastSpawnX = e.clientX; lastSpawnY = e.clientY;
    spawnShooterAt(e.clientX, e.clientY);
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointercancel', () => { dragging = false; });
  // kill native image/link drag so a hold-drag never shows the "no-drop" cursor
  addEventListener('dragstart', e => e.preventDefault());

  buildSpriteCache();
  resize();
  requestAnimationFrame(step);
})();
