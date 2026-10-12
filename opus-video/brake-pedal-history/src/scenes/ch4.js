/**
 * 第 4 章 · 一管液体（1921–1939，真空助力）
 * Art Deco 海报 + 液体动效：奶油底、金色放射线；3D 卡通深色底盘 + 墨线；红色是刹车油，沿管路带鼓包流满。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, easeInOut, pop, spring, maskText, callout, anchor, sequence, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const CREAM = '#F2E6CF', GOLD = '#B8893A', DARK = '#1F1A14', RED = '#B0281E';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  const hand = (t) => [Math.sin(t * 1.1) * 0.012, Math.sin(t * 1.7 + 1) * 0.01, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const MC = [0.95, 0.12, 0.2];
  let S = null;

  /** 奶油底 + 下方发散的金色放射线 */
  function decoTexture() {
    return STAGE.canvasTexture(W, H, (g) => {
      g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
      g.save(); g.translate(W / 2, H + 260); g.rotate(-Math.PI / 2);
      for (let i = 0; i < 40; i++) {
        g.rotate(Math.PI / 40);
        g.fillStyle = i % 2 ? 'rgba(184,137,58,0.11)' : 'rgba(184,137,58,0.035)';
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-80, -2400); g.lineTo(80, -2400); g.closePath(); g.fill();
      }
      g.restore();
      const r = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
      r.addColorStop(0, 'rgba(80,50,20,0)'); r.addColorStop(1, 'rgba(80,50,20,0.22)');
      g.fillStyle = r; g.fillRect(0, 0, W, H);
    });
  }

  /** 每根管/拉线的折点：主缸 → 车轮内侧 */
  function routes(pos) {
    return pos.map(([x, z]) => {
      const sz = Math.sign(z), wz = z - sz * 0.3;
      return x > 0
        ? [MC, [1.2, 0.12, sz * 0.15], [x - 0.05, 0.08, wz]]
        : [MC, [0.55, 0.12, sz * 0.32], [-0.6, 0.12, sz * 0.36], [x + 0.05, 0.08, wz]];
    });
  }

  function build() {
    const s = {};
    s.scene = new THREE.Scene();
    s.scene.background = decoTexture();
    s.cam = STAGE.camera(30);
    s.comp = STAGE.pipeline(s.scene, s.cam, { flat: true, ink: { color: 0x1f1a14, width: 1.4 }, grain: 0.05, vig: 0.1 });
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); s.scene.add(sun);
    const dark = STAGE.toon(0x3a3128), gold = STAGE.toon(0xc9a25a), red = STAGE.toon(0xb0281e);
    s.mats = { dark, gold, red };
    s.car = ME.chassis({ len: 4, track: 1.7, mat: gold, wheelMat: dark });
    s.scene.add(s.car.group);
    s.mc = new THREE.Group(); s.car.group.add(s.mc);
    const body = M.cyl([MC[0] - 0.22, MC[1], MC[2]], [MC[0] + 0.12, MC[1], MC[2]], 0.07, dark, 20); s.mc.add(body);
    s.pts = routes(s.car.pos);
    s.cables = s.pts.map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), dark); s.car.group.add(m); return m; });
    const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, depthWrite: false });
    s.pipes = s.pts.map((p) => { const pp = ME.pipe(p, { r: 0.04, glass, fluid: 0xb0281e }); s.car.group.add(pp.group); return pp; });
    s.pistons = s.car.pos.map(([x, z]) => { const m = M.cyl([0, 0, 0], [0, 0, 0.12], 0.05, red, 16); m.position.set(x, 0.08, z - Math.sign(z) * 0.24); m.rotation.y = z > 0 ? 0 : Math.PI; s.car.group.add(m); return m; });
    s.rings = s.car.pos.map(([x, z]) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 8, 64), red); r.position.set(x, 0, z); s.car.group.add(r); return r; });
    s.clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
    s.boost = ME.booster({ shell: STAGE.toon(0xd8c6a0), inner: dark, accent: red, clip: s.clip });
    s.scene.add(s.boost.group);
    s.arrIn = ME.arrow(dark, 0.03); s.arrOut = ME.arrow(red, 0.06);
    s.scene.add(s.arrIn, s.arrOut);
    return s;
  }

  /** 拉线：主缸 → 车轮的下垂曲线管，sag 为下垂量 */
  function setCable(mesh, pts, sag) {
    const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(...pts[pts.length - 1]);
    const mid = a.clone().lerp(b, 0.5); mid.y -= sag;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(curve, 32, 0.014, 6);
  }

  function only(...gs) { [S.car.group, S.boost.group, S.arrIn, S.arrOut].forEach((g) => { g.visible = gs.includes(g); }); }
  const frame = (dx) => (dx ? S.cam.setViewOffset(W, H, -dx, 0, W, H) : S.cam.clearViewOffset());

  SCENES[4] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, D = ch.vo_duration, full = ch.text;
      const a = (s) => vo + anchor(full, s, D);
      const sFour = a('四根拉线'), sPull = a('刹起来容易跑偏'), s21 = a('一九二一年'), sP = a('原理是帕斯卡'), sMaster = a('踏板推动主缸'),
        sEven = a('均匀地传到'), sLiquid = a('而是推一管液体'), sNew = a('新技术'), s39 = a('直到一九三九年'), sVac = a('后来，工程师'),
        sAmp = a('把脚上的力放大'), sName = a('这就是真空助力器'), sToday = a('今天你');

      /** A：机械拉线松紧不一 → 跑偏 */
      const shotCable = (t) => {
        only(S.car.group);
        frame(260);
        S.pipes.forEach((p) => { p.group.visible = false; });
        S.rings.forEach((r) => { r.visible = false; });
        S.pistons.forEach((p) => { p.visible = false; });
        const pull = smooth(prog(t, sPull, sPull + 1.2));
        const slack = [0.03, 0.16, 0.07, 0.24];
        S.cables.forEach((m, i) => {
          const k = pop(t, sFour + i * 0.12, 'card');
          m.visible = k > 0.02;
          const wob = 0.6 + 0.4 * Math.sin(t * 2.4 + i * 1.7);
          setCable(m, S.pts[i], slack[i] * wob * lerp(1, i % 2 ? 0.8 : 0.1, pull) * clamp(k, 0, 1.2));
        });
        S.car.group.rotation.set(0, 0.22 * easeInOut(prog(t, sPull + 0.3, sPull + 2.6)), 0);
        S.car.group.position.set(0, 0, 0);
        S.car.wheels.forEach((w, i) => { w.children[0].rotation.y = -t * 3 * (1 - pull * (i % 2 ? 0.3 : 0.9)); });
        const k = tail(prog(t, 0, s21));
        STAGE.aim(S.cam, add3(V([4.6, 4.4, 4.2], [3.6, 3.6, 3.4], k), hand(t)), [0, -0.1, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '机械拉线', 110, 250, pop(t, 0.3, 'heavy'), { size: 104, font: FONT_HEAD, color: DARK });
        maskText(ctx, '天生的毛病', 116, 320, pop(t, 0.6, 'card'), { size: 44, font: FONT_HEAD, color: GOLD });
        ['长短不一', '松紧不一'].forEach((w, i) => maskText(ctx, w, 116, 470 + i * 80, pop(t, sFour + 0.6 + i * 0.7, 'card'), { size: 56, font: FONT_HEAD, color: DARK }));
        maskText(ctx, '刹起来容易跑偏', 116, 700, pop(t, sPull, 'heavy'), { size: 64, font: FONT_HEAD, color: RED });
        if (t > sPull + 0.3) {
          const nose = STAGE.project([2.2, 0, 0], S.cam);
          const d = easeInOut(prog(t, sPull + 0.3, sPull + 2.6));
          ctx.save(); ctx.strokeStyle = RED; ctx.lineWidth = 5; ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 60;
          ctx.beginPath(); ctx.moveTo(nose.x, nose.y);
          ctx.quadraticCurveTo(nose.x + 220, nose.y + 40, nose.x + 220 + 120 * d, nose.y - 160 * d); ctx.stroke(); ctx.restore();
        }
      };

      /** B：杜森伯格四轮液压，刹车油流满管路 */
      const shotHydro = (t) => {
        only(S.car.group);
        frame(-150);
        S.car.group.rotation.set(0, 0, 0);
        S.cables.forEach((m) => { m.visible = false; });
        const fill = easeInOut(prog(t, sMaster + 0.3, sMaster + 3.2));
        S.pipes.forEach((p, i) => {
          const k = pop(t, s21 + 0.5 + i * 0.1, 'card');
          p.group.visible = k > 0.02;
          p.fluid.uniforms.uFill.value = fill * (i < 2 ? 1 : 1) * 1.02;
          p.fluid.uniforms.uTime.value = t;
        });
        const arrive = prog(t, sMaster + 3.0, sMaster + 3.2) >= 1;
        S.pistons.forEach((p, i) => {
          p.visible = true;
          const kk = pop(t, sMaster + 3.1 + i * 0.05, 'bouncy');
          const z = S.car.pos[i][1];
          p.position.z = z - Math.sign(z) * lerp(0.24, 0.16, clamp(kk, 0, 1.3));
        });
        S.rings.forEach((r, i) => { const kk = pop(t, sEven + i * 0.08, 'snap'); r.visible = kk > 0.02 && arrive; r.scale.setScalar(lerp(1.4, 1, clamp(kk))); });
        S.car.wheels.forEach((w) => { w.children[0].rotation.y = 0; });
        const k = tail(prog(t, s21, sNew));
        STAGE.aim(S.cam, add3(V([3.8, 5.2, 4.8], [3.0, 4.4, 4.0], k), hand(t)), [0.2, -0.1, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '1921', W - 110, 230, pop(t, s21, 'heavy'), { size: 140, font: FONT_HEAD, color: DARK, spacing: 6, align: 'right' });
        maskText(ctx, 'DUESENBERG MODEL A', W - 116, 290, pop(t, s21 + 0.3, 'snap'), { size: 30, font: FONT_MONO, color: GOLD, spacing: 2, align: 'right' });
        maskText(ctx, '量产车 · 四轮液压刹车', W - 116, 340, pop(t, s21 + 0.6, 'snap'), { size: 34, font: FONT_HEAD, color: DARK, align: 'right' });
        maskText(ctx, 'P = F / A', W - 120, 760, pop(t, sP, 'heavy'), { size: 72, font: FONT_MONO, color: RED, align: 'right' });
        maskText(ctx, '帕斯卡定律', W - 120, 820, pop(t, sP + 0.3, 'card'), { size: 32, font: FONT_HEAD, color: DARK, align: 'right' });
        const mp = STAGE.project([MC[0] - 0.1, MC[1] + 0.07, MC[2]], S.cam);
        callout(ctx, mp.x, mp.y, mp.x - 240, mp.y + 170, '主缸', pop(t, sMaster, 'card'), { color: DARK, size: 40, font: FONT_HEAD, sub: 'MASTER CYLINDER' });
        if (arrive) S.car.pos.forEach(([x, z], i) => {
          const q = STAGE.project([x, 0.5, z], S.cam);
          maskText(ctx, 'P', q.x, q.y, pop(t, sEven + i * 0.08, 'snap'), { size: 40, font: FONT_MONO, color: RED, align: 'center' });
        });
        maskText(ctx, '压力 · 处处相等', W - 120, 890, pop(t, sEven + 0.3, 'card'), { size: 36, font: FONT_HEAD, color: DARK, align: 'right' });
        maskText(ctx, '不再拉钢丝，而是推一管液体', W - 120, 980, pop(t, sLiquid, 'heavy'), { size: 36, font: FONT_HEAD, color: RED, align: 'right' });
      };

      /** C：1921 → 1939 年份滚动 */
      const shotYears = (t) => {
        ctx.fillStyle = CREAM; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H + 260); ctx.rotate(-Math.PI / 2 + Math.sin(t * 0.2) * 0.02);
        for (let i = 0; i < 40; i++) { ctx.rotate(Math.PI / 40); ctx.fillStyle = i % 2 ? 'rgba(184,137,58,0.11)' : 'rgba(184,137,58,0.035)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-80, -2400); ctx.lineTo(80, -2400); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        const k = easeInOut(prog(t, sNew + 0.5, s39 + 0.4));
        const yr = Math.round(lerp(1921, 1939, k));
        const x0 = 260, x1 = W - 260, y = 640;
        ctx.save(); ctx.strokeStyle = DARK; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, smooth(prog(t, sNew, sNew + 0.8))), y); ctx.stroke();
        for (let i = 0; i <= 18; i++) {
          const x = lerp(x0, x1, i / 18), kk = pop(t, sNew + 0.2 + i * 0.04, 'snap');
          if (kk <= 0) continue;
          ctx.lineWidth = i % 5 === 4 || i === 0 || i === 18 ? 3 : 1.5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - (i % 5 === 4 || i === 0 || i === 18 ? 28 : 14) * kk); ctx.stroke();
        }
        const hx = lerp(x0, x1, k);
        ctx.fillStyle = RED; ctx.fillRect(x0, y - 4, hx - x0, 8);
        ctx.beginPath(); ctx.arc(hx, y, 12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        maskText(ctx, '1921', x0, y + 70, pop(t, sNew + 0.3, 'card'), { size: 40, font: FONT_MONO, color: DARK, align: 'center' });
        maskText(ctx, '1939', x1, y + 70, pop(t, sNew + 0.5, 'card'), { size: 40, font: FONT_MONO, color: DARK, align: 'center' });
        maskText(ctx, String(yr), W / 2, 480, pop(t, sNew + 0.3, 'heavy'), { size: 220, font: FONT_HEAD, color: k >= 1 ? RED : DARK, align: 'center', spacing: 8 });
        maskText(ctx, '新技术并没有马上被接受', W / 2, 260, pop(t, sNew, 'card'), { size: 44, font: FONT_HEAD, color: GOLD, align: 'center' });
        maskText(ctx, '福特 · 最后一家改用液压的美国大厂', W / 2, 860, pop(t, s39 + 0.6, 'heavy'), { size: 56, font: FONT_HEAD, color: DARK, align: 'center' });
        L.paper(ctx, 0.25);
      };

      /** D：真空助力器剖面 */
      const shotBoost = (t) => {
        only(S.boost.group, S.arrIn, S.arrOut);
        frame(0);
        const k0 = pop(t, sVac + 0.2, 'heavy');
        S.boost.group.scale.setScalar(clamp(k0, 0, 1.05) * 0.9);
        S.boost.group.position.set(-0.1, 0.3, 0);
        const push = smooth(prog(t, sAmp, sAmp + 0.8)) * (1 - 0.15 * (0.5 + 0.5 * Math.sin(t * 2.2)) * smooth(prog(t, sName, sName + 1)));
        S.boost.setPush(push);
        S.arrIn.rotation.z = -Math.PI / 2; S.arrIn.position.set(-2.3, 0.15, 0); S.arrIn.userData.set(0.55 * pop(t, sAmp - 0.3, 'snap'));
        const amp = smooth(prog(t, sAmp + 0.5, sAmp + 2));
        S.arrOut.rotation.z = -Math.PI / 2; S.arrOut.position.set(1.9, 0.15, 0); S.arrOut.userData.set(lerp(0.3, 1.3, amp) * pop(t, sAmp + 0.3, 'heavy'));
        const k = tail(prog(t, sVac, ch.end - ch.start));
        STAGE.aim(S.cam, add3(V([-3.0, 1.9, 5.6], [-2.4, 1.5, 4.9], k), hand(t)), [0.1, 0, 0], 30);
        STAGE.draw(S.comp, T);
        const fi = STAGE.project([-2.0, 0.42, 0], S.cam), fo = STAGE.project([2.4, 0.55, 0], S.cam);
        maskText(ctx, '脚的力', fi.x, fi.y, pop(t, sAmp - 0.2, 'card'), { size: 40, font: FONT_HEAD, color: DARK, align: 'center' });
        maskText(ctx, '× 数倍', fo.x, fo.y, pop(t, sAmp + 0.8, 'heavy'), { size: 64, font: FONT_HEAD, color: RED, align: 'center' });
        const dp = STAGE.project([0.35, 0.7, 0], S.cam);
        callout(ctx, dp.x, dp.y, dp.x + 160, 200, '借发动机的真空', pop(t, sVac + 1.4, 'card'), { color: DARK, size: 40, font: FONT_HEAD, sub: 'VACUUM · 膜片' });
        maskText(ctx, '真空助力器', W / 2, 860, pop(t, sName, 'heavy'), { size: 88, font: FONT_HEAD, color: DARK, align: 'center', spacing: 10 });
        maskText(ctx, '轻轻一踩 · 刹住两吨', W / 2, 950, pop(t, sToday, 'card'), { size: 44, font: FONT_HEAD, color: GOLD, align: 'center' });
      };

      sequence(ctx, t, [
        { t0: 0, f: shotCable },
        { t0: s21, f: shotHydro, tr: 'zoom' },
        { t0: sNew, f: shotYears, tr: 'wipe' },
        { t0: sVac, f: shotBoost, tr: 'zoom' },
      ]);
    },
  };
})();
