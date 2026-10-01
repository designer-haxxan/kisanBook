// KisanBook Login Hero — draws a Pakistani farm dawn landscape on the canvas.
// Triggered when #view-login becomes visible (auth check complete).

function drawFarm(canvas) {
  const W = canvas.offsetWidth || 700;
  const H = canvas.offsetHeight || 600;
  canvas.width  = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  canvas.style.width  = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // ── Sky ──────────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.58);
  sky.addColorStop(0,    '#050f08');
  sky.addColorStop(0.35, '#0b2418');
  sky.addColorStop(0.7,  '#143d22');
  sky.addColorStop(1,    '#b85a12');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.58);

  // ── Sun glow at horizon ──────────────────────────────────
  const sg = ctx.createRadialGradient(W * 0.62, H * 0.56, 0, W * 0.62, H * 0.56, W * 0.32);
  sg.addColorStop(0,   'rgba(255,130,20,.65)');
  sg.addColorStop(0.4, 'rgba(220,90,10,.2)');
  sg.addColorStop(1,   'rgba(200,60,0,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H * 0.58);

  // ── Sun disc ─────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(W * 0.62, H * 0.58, W * 0.042, 0, Math.PI * 2);
  ctx.fillStyle = '#ffb830';
  ctx.fill();

  // ── Crescent moon (Pakistan symbol) ─────────────────────
  const mx = W * 0.22, my = H * 0.13, mr = W * 0.038;
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,245,195,.92)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(mx + mr * 0.6, my - mr * 0.12, mr * 0.8, 0, Math.PI * 2);
  ctx.fillStyle = '#0b2418'; // occludes part of moon
  ctx.fill();

  // ── Star near crescent ──────────────────────────────────
  const sx = mx + mr * 1.6, sy = my - mr * 0.8, sr = mr * 0.2;
  for (let i = 0; i < 5; i++) {
    const a = (i * 4 * Math.PI / 5) - Math.PI / 2;
    const b = a + (2 * Math.PI / 5);
    if (i === 0) ctx.beginPath();
    ctx.lineTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr);
    ctx.lineTo(sx + Math.cos(b) * sr * 0.42, sy + Math.sin(b) * sr * 0.42);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,245,195,.9)';
  ctx.fill();

  // ── Stars in sky ─────────────────────────────────────────
  const stars = [
    [.08,.05],[.15,.15],[.35,.04],[.45,.1],[.52,.22],[.72,.06],[.8,.14],
    [.88,.07],[.3,.18],[.9,.2],[.05,.25],[.6,.03],[.42,.26],[.76,.24],
  ];
  stars.forEach(([fx, fy]) => {
    ctx.beginPath();
    ctx.arc(W * fx, H * fy, 1.0 + Math.random() * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.45 + Math.random() * 0.4})`;
    ctx.fill();
  });

  // ── Ground base ──────────────────────────────────────────
  const ground = ctx.createLinearGradient(0, H * 0.55, 0, H);
  ground.addColorStop(0, '#1b4d2a');
  ground.addColorStop(0.4, '#235e32');
  ground.addColorStop(1,   '#163c20');
  ctx.fillStyle = ground;
  ctx.fillRect(0, H * 0.55, W, H);

  // ── Crop-row texture in fields ───────────────────────────
  ctx.strokeStyle = 'rgba(80,180,80,.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const y = H * 0.58 + i * (H * 0.42 / 18);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y - i * 0.9);
    ctx.stroke();
  }

  // ── Irrigation canal ─────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0,    H * 0.73);
  ctx.lineTo(W,    H * 0.665);
  ctx.lineTo(W,    H * 0.70);
  ctx.lineTo(0,    H * 0.77);
  ctx.closePath();
  const canal = ctx.createLinearGradient(0, H * 0.73, W, H * 0.665);
  canal.addColorStop(0,   'rgba(80,160,210,.55)');
  canal.addColorStop(0.5, 'rgba(110,185,230,.45)');
  canal.addColorStop(1,   'rgba(80,160,210,.4)');
  ctx.fillStyle = canal;
  ctx.fill();
  // Canal highlight
  ctx.beginPath();
  ctx.moveTo(0, H * 0.73);
  ctx.lineTo(W, H * 0.665);
  ctx.strokeStyle = 'rgba(180,220,255,.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // ── Canal reflection of sun ──────────────────────────────
  const ref = ctx.createRadialGradient(W * 0.62, H * 0.685, 0, W * 0.62, H * 0.685, W * 0.1);
  ref.addColorStop(0, 'rgba(255,180,50,.35)');
  ref.addColorStop(1, 'rgba(255,180,50,0)');
  ctx.fillStyle = ref;
  ctx.fillRect(0, H * 0.665, W, H * 0.035);

  // ── Poplar trees (Punjab landscape) ─────────────────────
  const drawPoplar = (x, h, w) => {
    // Trunk
    ctx.fillStyle = '#0a1e0f';
    ctx.fillRect(x - w * 0.08, H * 0.56 - h * 0.15, w * 0.16, h * 0.15);
    // Crown (tall ellipse)
    ctx.beginPath();
    ctx.ellipse(x, H * 0.56 - h * 0.6, w * 0.5, h * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0c2215';
    ctx.fill();
  };
  drawPoplar(W * 0.07,  H * 0.19, W * 0.022);
  drawPoplar(W * 0.115, H * 0.23, W * 0.024);
  drawPoplar(W * 0.16,  H * 0.17, W * 0.02);
  drawPoplar(W * 0.2,   H * 0.21, W * 0.023);
  drawPoplar(W * 0.245, H * 0.15, W * 0.019);

  // ── Farmhouse silhouette ──────────────────────────────────
  const hx = W * 0.75, hy = H * 0.56;
  const hw = W * 0.13, hh = H * 0.115;
  // Body
  ctx.fillStyle = '#0a1e0f';
  ctx.fillRect(hx - hw / 2, hy - hh, hw, hh);
  // Roof
  ctx.beginPath();
  ctx.moveTo(hx - hw * 0.6, hy - hh);
  ctx.lineTo(hx,            hy - hh - hh * 0.7);
  ctx.lineTo(hx + hw * 0.6, hy - hh);
  ctx.closePath();
  ctx.fillStyle = '#081508';
  ctx.fill();
  // Door
  ctx.fillStyle = 'rgba(255,140,30,.4)';
  ctx.fillRect(hx - hw * 0.12, hy - hh * 0.48, hw * 0.24, hh * 0.48);
  // Window
  ctx.fillStyle = 'rgba(255,200,80,.35)';
  ctx.fillRect(hx + hw * 0.18, hy - hh * 0.65, hw * 0.18, hw * 0.14);

  // ── Wheat row foreground ──────────────────────────────────
  for (let i = 0; i <= 18; i++) {
    const bx = (W / 18) * i;
    const bh = H * 0.055 + Math.sin(i * 1.4) * H * 0.012;
    // Stalk
    ctx.strokeStyle = 'rgba(140,200,80,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx, H);
    ctx.lineTo(bx + Math.sin(i) * 6, H - bh);
    ctx.stroke();
    // Ear (small oval)
    ctx.save();
    ctx.translate(bx + Math.sin(i) * 6, H - bh);
    ctx.rotate(Math.sin(i * 0.7) * 0.2);
    ctx.fillStyle = 'rgba(200,170,60,.6)';
    ctx.beginPath();
    ctx.ellipse(0, -4, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Atmospheric haze at horizon ───────────────────────────
  const haze = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.62);
  haze.addColorStop(0, 'rgba(200,120,40,.0)');
  haze.addColorStop(0.5, 'rgba(200,100,20,.18)');
  haze.addColorStop(1, 'rgba(30,80,40,.0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.5, W, H * 0.12);
}

// Watch for login view to become visible
const loginEl = document.getElementById('view-login');
const heroCanvas = document.getElementById('hero-canvas');

if (loginEl && heroCanvas) {
  let drawn = false;
  const tryDraw = () => {
    if (drawn) return;
    if (!loginEl.classList.contains('d-none') && heroCanvas.offsetWidth > 0) {
      drawn = true;
      drawFarm(heroCanvas);
    }
  };
  const obs = new MutationObserver(tryDraw);
  obs.observe(loginEl, { attributes: true, attributeFilter: ['class'] });
  // Also handle if already visible on load
  tryDraw();
}
