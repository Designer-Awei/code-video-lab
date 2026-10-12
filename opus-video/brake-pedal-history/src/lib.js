/**
 * 公共工具：缓动、弹簧、种子随机、文字、纹理、主角踏板。
 * 所有函数都是纯函数或只依赖初始化时用固定种子生成的纹理，保证任意 t 单独渲染结果一致。
 */
(function () {
  const W = 1920, H = 1080;

  /** @param {number} x @param {number} [a] @param {number} [b] */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  /** 把 t 在 [a,b] 区间映射到 [0,1] */
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const easeIn = (t) => Math.pow(clamp(t), 3);

  /**
   * 闭式弹簧，x 为距目标改变的时间（秒）。
   * @param {number} x @param {number} [w] 角频率 @param {number} [z] 阻尼比
   */
  function spring(x, w = 16, z = 0.72) {
    if (x <= 0) return 0;
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
  }

  /**
   * 多段弹簧：值在 t_i 时刻把目标改成 v_i，动作连续、可单帧求值。
   * v(t) = v0 + Σ (v_i − v_{i−1}) · spring(t − t_i)
   * @param {number} t @param {Array<[number, number|number[]]>} keys [[t0,v0],[t1,v1],...] 值可为数字或数组
   * @param {number} [w] @param {number} [z]
   */
  function track(t, keys, w = 14, z = 0.75) {
    const arr = Array.isArray(keys[0][1]);
    let v = arr ? keys[0][1].slice() : keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = spring(t - keys[i][0], w, z);
      if (arr) for (let j = 0; j < v.length; j++) v[j] += (keys[i][1][j] - keys[i - 1][1][j]) * k;
      else v += (keys[i][1] - keys[i - 1][1]) * k;
    }
    return v;
  }

  /** 弹簧档位（同类元素用同一档） */
  const SP = { snap: [24, 0.8], card: [15, 0.72], heavy: [10, 0.92], bouncy: [18, 0.45] };
  /** 某档弹簧在 t0 之后的进度 @param {number} t @param {number} t0 @param {'snap'|'card'|'heavy'|'bouncy'} [kind] */
  const pop = (t, t0, kind = 'card') => spring(t - t0, SP[kind][0], SP[kind][1]);

  /** mulberry32 种子随机数生成器 @param {number} seed @returns {() => number} */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 整数哈希到 [0,1) @param {number} i */
  const hash = (i) => rng(i * 9301 + 49297)();

  const FONT_HEAD = '"HSBold", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  const FONT_BODY = '"HSRegular", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';
  const FONT_MONO = '"CMono", Consolas, monospace';

  /**
   * 写字。
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} s
   * @param {number} x @param {number} y
   * @param {{size?:number,font?:string,color?:string,align?:CanvasTextAlign,base?:CanvasTextBaseline,alpha?:number,spacing?:number}} [o]
   */
  function text(ctx, s, x, y, o = {}) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.font = `${o.size ?? 48}px ${o.font ?? FONT_HEAD}`;
    ctx.fillStyle = o.color ?? '#fff';
    ctx.textAlign = o.align ?? 'left';
    ctx.textBaseline = o.base ?? 'alphabetic';
    if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
    ctx.fillText(s, x, y);
    ctx.restore();
  }

  /**
   * 逐字出现的文字（打字机），每个字有自己的进场。
   * @param {CanvasRenderingContext2D} ctx @param {string} s @param {number} x @param {number} y
   * @param {number} p 0..1 进度 @param {object} [o] 同 text
   */
  function typeText(ctx, s, x, y, p, o = {}) {
    const n = Math.floor(s.length * clamp(p) + 0.0001);
    text(ctx, s.slice(0, n), x, y, o);
  }

  /**
   * 遮罩上滑出字：文字从自身行框下沿滑上来，k 是弹簧进度（可超过 1 产生回弹）。
   * k 为负或 0 时不画；出场时传 2-k 之类的值会向上滑出。
   * @param {CanvasRenderingContext2D} ctx @param {string} s @param {number} x @param {number} y 基线
   * @param {number} k @param {object} [o] 同 text
   */
  function maskText(ctx, s, x, y, k, o = {}) {
    if (k <= 0) return;
    const size = o.size ?? 48;
    ctx.save();
    ctx.font = `${size}px ${o.font ?? FONT_HEAD}`;
    if (o.spacing) ctx.letterSpacing = `${o.spacing}px`;
    const w = ctx.measureText(s).width;
    const align = o.align ?? 'left';
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (o.bg) {
      const pad = size * 0.32, bw = (w + pad * 2) * Math.min(1, k * 1.4);
      ctx.save(); ctx.globalAlpha *= 0.94; ctx.fillStyle = o.bg;
      ctx.fillRect(align === 'right' ? x0 + w + pad - bw : x0 - pad, y - size * 1.0, bw, size * 1.32);
      ctx.restore();
    }
    ctx.beginPath(); ctx.rect(x0 - 20, y - size * 1.05, w + 40, size * 1.35); ctx.clip();
    text(ctx, s, x, y + (1 - k) * size * 1.3, o);
    ctx.restore();
  }

  /**
   * 引线标注：从屏幕点 (ax,ay) 拉一条折线到文字。p 为进度 0..1。
   * @param {CanvasRenderingContext2D} ctx @param {number} ax @param {number} ay @param {number} lx 文字起点 x @param {number} ly 文字基线 y
   * @param {string} s @param {number} p @param {{color?:string,size?:number,dot?:boolean,sub?:string}} [o]
   */
  function callout(ctx, ax, ay, lx, ly, s, p, o = {}) {
    if (p <= 0) return;
    const color = o.color ?? '#fff', size = o.size ?? 32;
    const right = lx >= ax;
    const elbowX = lx + (right ? -24 : 24);
    const pts = [[ax, ay], [elbowX, ly - size * 0.35], [lx + (right ? -8 : 8), ly - size * 0.35]];
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
    const lp = clamp(p * 1.6);
    if (o.dot !== false) { ctx.beginPath(); ctx.arc(ax, ay, 5 * clamp(p * 4), 0, Math.PI * 2); ctx.fill(); }
    strokePartial(ctx, pts, lp);
    ctx.restore();
    const tk = clamp((p - 0.45) / 0.55) * 1.0;
    if (o.sub) maskText(ctx, o.sub, lx, ly + size * 0.95, smooth(clamp((p - 0.6) / 0.4)), { size: size * 0.62, color: o.subColor ?? color, align: right ? 'left' : 'right', font: FONT_MONO, bg: o.bg });
    maskText(ctx, s, lx, ly, tk < 1 ? smooth(tk) : 1, { size, color, align: right ? 'left' : 'right', font: o.font, bg: o.bg });
  }

  /**
   * 真实截图左下角的来源标注（固定格式）。
   * @param {CanvasRenderingContext2D} ctx @param {string} s @param {number} [alpha]
   */
  function sourceTag(ctx, s, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.font = `22px ${FONT_BODY}`;
    const w = ctx.measureText(s).width + 36;
    ctx.fillRect(56, H - 92, w, 40);
    ctx.fillStyle = '#E8412C';
    ctx.fillRect(56, H - 92, 4, 40);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.textBaseline = 'middle';
    ctx.fillText(s, 74, H - 72);
    ctx.restore();
  }

  /**
   * 镜头：围绕焦点缩放并平移。调用后记得 ctx.restore()。
   * @param {CanvasRenderingContext2D} ctx @param {number} zoom @param {number} fx @param {number} fy @param {number} [dx] @param {number} [dy]
   */
  function camera(ctx, zoom, fx, fy, dx = 0, dy = 0) {
    ctx.save();
    ctx.translate(W / 2 + dx, H / 2 + dy);
    ctx.scale(zoom, zoom);
    ctx.translate(-fx, -fy);
  }

  /** 生成一张固定种子的噪声贴图 @param {number} w @param {number} h @param {number} seed @param {number} amp */
  function noiseCanvas(w, h, seed, amp) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const r = rng(seed);
    for (let i = 0; i < w * h; i++) {
      const v = (r() - 0.5) * amp + 128;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  let grainTiles = null, paperTex = null;
  /** 初始化纹理（只调用一次，固定种子） */
  function initTextures() {
    grainTiles = [0, 1, 2, 3].map((i) => noiseCanvas(480, 270, 1000 + i, 140));
    const p = document.createElement('canvas');
    p.width = W; p.height = H;
    const g = p.getContext('2d');
    g.drawImage(noiseCanvas(W / 2, H / 2, 77, 40), 0, 0, W, H);
    const r = rng(78);
    g.globalAlpha = 0.06;
    for (let i = 0; i < 1400; i++) {
      g.strokeStyle = r() > 0.5 ? '#000' : '#fff';
      g.lineWidth = r() * 1.2;
      const x = r() * W, y = r() * H, l = 10 + r() * 60, a = r() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    paperTex = p;
  }

  /** 胶片颗粒，每秒换 24 次 @param {CanvasRenderingContext2D} ctx @param {number} t @param {number} [amount] */
  function grain(ctx, t, amount = 0.09) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = amount;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(grainTiles[Math.floor(t * 24) % 4], 0, 0, W, H);
    ctx.restore();
  }

  /** 纸纹叠加 @param {CanvasRenderingContext2D} ctx @param {number} [amount] */
  function paper(ctx, amount = 0.35) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = amount;
    ctx.drawImage(paperTex, 0, 0);
    ctx.restore();
  }

  /** 暗角 @param {CanvasRenderingContext2D} ctx @param {number} [strength] @param {string} [rgb] */
  function vignette(ctx, strength = 0.55, rgb = '0,0,0') {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, `rgba(${rgb},0)`);
    g.addColorStop(1, `rgba(${rgb},${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /**
   * 主角踏板（现代吊挂式）的轮廓路径，局部坐标：转轴在 (0,0)，踏板面中心约在 (40, 400)。
   * @param {CanvasRenderingContext2D} ctx
   */
  function pedalPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-14, -10);
    ctx.bezierCurveTo(-18, 120, 10, 260, 12, 352);
    ctx.lineTo(-48, 360); ctx.quadraticCurveTo(-58, 362, -56, 374);
    ctx.lineTo(-44, 446); ctx.quadraticCurveTo(-42, 456, -30, 456);
    ctx.lineTo(118, 446); ctx.quadraticCurveTo(130, 444, 128, 432);
    ctx.lineTo(114, 360); ctx.quadraticCurveTo(112, 350, 100, 350);
    ctx.lineTo(42, 350);
    ctx.bezierCurveTo(38, 250, 18, 120, 14, -10);
    ctx.closePath();
  }

  /** 支架与转轴 @param {CanvasRenderingContext2D} ctx */
  function bracketPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-70, -70); ctx.lineTo(80, -70); ctx.lineTo(60, 30); ctx.lineTo(-50, 30); ctx.closePath();
  }

  /** 沿折线取弧长参数点 @param {number[][]} pts @param {number} p 0..1 @returns {{x:number,y:number,a:number,len:number}} */
  function alongPath(pts, p) {
    let total = 0; const seg = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); total += l; }
    let d = clamp(p) * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const k = seg[i] ? d / seg[i] : 0;
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        return { x: lerp(x0, x1, k), y: lerp(y0, y1, k), a: Math.atan2(y1 - y0, x1 - x0), len: total };
      }
      d -= seg[i];
    }
    return { x: pts[0][0], y: pts[0][1], a: 0, len: total };
  }

  /** 画折线的前 p 部分 @param {CanvasRenderingContext2D} ctx @param {number[][]} pts @param {number} p */
  function strokePartial(ctx, pts, p) {
    if (p <= 0) return;
    const end = alongPath(pts, p);
    let total = 0, acc = 0; const lens = [];
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(l); total += l; }
    const target = clamp(p) * total;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      if (acc + lens[i - 1] >= target) { ctx.lineTo(end.x, end.y); break; }
      ctx.lineTo(pts[i][0], pts[i][1]); acc += lens[i - 1];
    }
    ctx.stroke();
  }

  /**
   * 生成一条锯齿裂纹折线（固定种子）。
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} seed @param {number} [n]
   */
  function crackPoints(x0, y0, x1, y1, seed, n = 18) {
    const r = rng(seed); const pts = [];
    const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny);
    for (let i = 0; i <= n; i++) {
      const k = i / n, j = (i === 0 || i === n) ? 0 : (r() - 0.5) * 70;
      pts.push([lerp(x0, x1, k) + nx / nl * j, lerp(y0, y1, k) + ny / nl * j]);
    }
    return pts;
  }

  /**
   * 按配音字符位置估算某句话的时间（秒，相对配音起点）。
   * @param {string} full 配音全文 @param {string} phrase 句子开头片段 @param {number} dur 配音时长
   */
  function anchor(full, phrase, dur) {
    const i = full.indexOf(phrase);
    return i < 0 ? 0 : (i / full.length) * dur;
  }

  /**
   * 平放的真实截图卡片：白边 + 投影，不做透视，保证可读。k 为弹簧进场进度（可回弹超过 1）。
   * @param {CanvasRenderingContext2D} ctx @param {HTMLImageElement} img
   * @param {number} cx @param {number} cy 卡片中心 @param {number} w 卡片宽 @param {number} rot 静止时的角度（弧度）
   * @param {number} k
   * @param {{sy?:number,sh?:number,from?:number[],rot0?:number,border?:number}} [o] sy/sh 纵向裁切（图片像素），from 进场起点偏移
   * @returns {{x:number,y:number,w:number,h:number,s:number}|null} 静止状态下图片区域与缩放
   */
  function card(ctx, img, cx, cy, w, rot, k, o = {}) {
    if (!img) return null;
    const sy = o.sy ?? 0, sh = Math.min(o.sh ?? img.height, img.height - sy);
    const h = w * sh / img.width, b = o.border ?? 10;
    const box = { x: cx - w / 2, y: cy - h / 2, w, h, s: w / img.width };
    if (k <= 0) return box;
    const [fx, fy] = o.from ?? [0, 140], u = 1 - k;
    ctx.save();
    ctx.translate(cx + fx * u, cy + fy * u);
    ctx.rotate(rot + (o.rot0 ?? 0.05) * u);
    const sc = 1 + 0.05 * u; ctx.scale(sc, sc);
    ctx.globalAlpha *= clamp(k * 2.5);
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 48; ctx.shadowOffsetY = 22;
    ctx.fillStyle = '#f3f3f0'; ctx.fillRect(-w / 2 - b, -h / 2 - b, w + b * 2, h + b * 2);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(img, 0, sy, img.width, sh, -w / 2, -h / 2, w, h);
    ctx.restore();
    return box;
  }

  /** 转场用的两块离屏帧缓冲 */
  const bufs = [];
  /**
   * 把一个镜头完整渲染（3D 层 + 2D 层）并拍平到离屏缓冲。
   * @param {CanvasRenderingContext2D} ctx @param {number} i 缓冲序号 @param {() => void} fn
   */
  function capture(ctx, i, fn) {
    if (!bufs[i]) { const c = document.createElement('canvas'); c.width = W; c.height = H; bufs[i] = c; }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    STAGE.used = false;
    fn();
    const g = bufs[i].getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    if (STAGE.used) g.drawImage(STAGE.renderer.domElement, 0, 0);
    g.drawImage(ctx.canvas, 0, 0);
    return bufs[i];
  }

  let squeeze = null;
  /**
   * 横向运动模糊：先把整帧横向压缩 f 倍再拉回，双线性插值得到平滑的水平拖影。
   * @param {CanvasRenderingContext2D} ctx @param {HTMLCanvasElement} img @param {number} x 绘制偏移 @param {number} f 压缩倍数（1 为不模糊）
   */
  function hblur(ctx, img, x, f) {
    if (f <= 1.05) { ctx.drawImage(img, x, 0); return; }
    if (!squeeze) { squeeze = document.createElement('canvas'); squeeze.height = H; }
    const w = Math.max(16, Math.round(W / f));
    squeeze.width = w;
    const g = squeeze.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, w, H);
    ctx.save(); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(squeeze, x, 0, W, H);
    ctx.restore();
  }

  /** 以画面中心缩放 @param {CanvasRenderingContext2D} ctx @param {number} z */
  const scaleAt = (ctx, z) => { ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); };

  /**
   * 两个镜头之间的转场：各自完整渲染一帧再合成，结果全部画在 2D 层上。
   * whip 甩镜（横向带运动模糊）· zoom 推进穿越 · wipe 斜切划像（红色切线）· dip 过黑。
   * @param {CanvasRenderingContext2D} ctx @param {'whip'|'zoom'|'wipe'|'dip'} type @param {number} k 0..1
   * @param {() => void} drawA 出镜头 @param {() => void} drawB 入镜头
   */
  function transition(ctx, type, k, drawA, drawB) {
    const A = capture(ctx, 0, drawA), B = capture(ctx, 1, drawB);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const e = easeInOut(k);
    if (type === 'whip') {
      const v = (k < 0.5 ? 12 * k * k : 12 * (1 - k) * (1 - k)) / 3, f = 1 + 40 * v * v;
      hblur(ctx, A, -e * W, f);
      hblur(ctx, B, (1 - e) * W, f);
    } else if (type === 'zoom') {
      const za = 1 + 0.45 * easeIn(k), kb = prog(k, 0.3, 1), zb = lerp(1.2, 1, easeOut(kb));
      ctx.save(); scaleAt(ctx, za); ctx.filter = `blur(${(14 * easeIn(k)).toFixed(1)}px)`; ctx.drawImage(A, 0, 0); ctx.restore();
      ctx.save(); ctx.globalAlpha = smooth(prog(k, 0.25, 0.65)); scaleAt(ctx, zb);
      const bb = 14 * (1 - easeOut(kb));
      if (bb > 0.3) ctx.filter = `blur(${bb.toFixed(1)}px)`;
      ctx.drawImage(B, 0, 0); ctx.restore();
    } else if (type === 'wipe') {
      const slope = 0.22, edge = lerp(-slope * H - 20, W + slope * H + 20, e);
      ctx.save(); scaleAt(ctx, 1 + 0.06 * e); ctx.drawImage(A, 0, 0); ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(edge + slope * H / 2, 0); ctx.lineTo(edge - slope * H / 2, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
      scaleAt(ctx, 1.06 - 0.06 * e); ctx.drawImage(B, 0, 0);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = '#E8412C'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(edge + slope * H / 2, 0); ctx.lineTo(edge - slope * H / 2, H); ctx.stroke(); ctx.restore();
    } else {
      ctx.save(); ctx.globalAlpha = 1 - smooth(k * 2); ctx.drawImage(A, 0, 0); ctx.restore();
      ctx.save(); ctx.globalAlpha = smooth(k * 2 - 1); ctx.drawImage(B, 0, 0); ctx.restore();
    }
    STAGE.used = false;
  }

  /** 各类转场的默认时长（秒） */
  const TR_DUR = { whip: 0.5, zoom: 0.7, wipe: 0.8, dip: 0.9 };

  /**
   * 按镜头表绘制：镜头 i 带 tr 时，在它开始后的 TR_DUR 秒内与上一个镜头做转场；没有 tr 就是硬切。
   * 镜头函数只由 t 决定，转场期间出镜头会继续按 t 往后演。
   * @param {CanvasRenderingContext2D} ctx @param {number} t
   * @param {Array<{t0:number, f:(t:number)=>void, tr?:'whip'|'zoom'|'wipe'|'dip', dur?:number}>} shots 按 t0 升序
   */
  function sequence(ctx, t, shots) {
    let i = 0;
    while (i + 1 < shots.length && t >= shots[i + 1].t0) i++;
    const s = shots[i], d = s.dur ?? TR_DUR[s.tr];
    if (i > 0 && s.tr && t - s.t0 < d) transition(ctx, s.tr, (t - s.t0) / d, () => shots[i - 1].f(t), () => s.f(t));
    else s.f(t);
  }

  window.L = {
    W, H, clamp, lerp, prog, smooth, easeInOut, easeOut, easeIn, spring, track, SP, pop, rng, hash,
    FONT_HEAD, FONT_BODY, FONT_MONO, text, typeText, maskText, callout, sourceTag, camera,
    initTextures, grain, paper, vignette, pedalPath, bracketPath, alongPath, strokePartial, crackPoints, anchor,
    card, transition, sequence, TR_DUR,
  };
})();
