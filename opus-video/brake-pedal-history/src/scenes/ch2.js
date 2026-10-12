/**
 * 第 2 章 · 没有踏板的第一辆车（1886–1888）
 * 线描一笔画 + 3D 铜版画：裁剪面扫过车身时墨线生长 → 排线从暗部长出（线转面）；红线是力的路径。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, easeIn, easeOut, easeInOut, pop, track, maskText, callout, anchor, sequence, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const INK = '#2A2118', RED = '#8C2F1B', PAPER = '#EDE3CC';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  let S = null;

  /** 红色力线（3D，可按进度画出） */
  function forceLine(pts) {
    const g = new THREE.LineGeometry(); g.setPositions(pts.flat());
    const m = new THREE.LineMaterial({ color: 0x8c2f1b, linewidth: 6 }); m.resolution.set(W, H);
    const l = new THREE.Line2(g, m);
    l.userData.n = pts.length - 1;
    return l;
  }
  const showLine = (l, k) => { l.geometry.instanceCount = Math.round(l.userData.n * clamp(k)); l.visible = k > 0; };

  function build() {
    const s = {};
    s.scene = new THREE.Scene();
    s.scene.background = new THREE.Color(0xede3cc);
    s.cam = STAGE.camera(30);
    s.car = MH.motorwagen();
    s.scene.add(s.car.group);
    s.clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 2);
    s.comp = STAGE.pipeline(s.scene, s.cam, { flat: true, ink: { width: 1.4, depth: 0.3, normal: 0.45 }, grain: 0.05, vig: 0.22 });
    // 力线：手柄 → 杠杆根部 → 连杆 → 皮带轮
    s.f1 = forceLine([[0.04, 0.64, 0.02], [0.03, 0.4, 0.02], [0.01, 0.2, 0.02], [0, 0.08, 0.02]]);
    s.car.lever.add(s.f1);
    s.f2 = forceLine([[0.287, 0.633, 0.5], [0.2, 0.64, 0.41], [0.1, 0.65, 0.31], [-0.01, 0.66, 0.2]]);
    s.scene.add(s.f2);
    s.nails = [0, 1, 2].map((i) => { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6), s.car.drawing.fill); n.rotation.z = Math.PI / 2; s.car.block.add(n); n.position.set(-0.07, -0.05 + i * 0.05, 0); return n; });

    s.map = new THREE.Scene();
    s.map.background = new THREE.Color(0xede3cc);
    s.camMap = STAGE.camera(36);
    s.terrain = MH.terrain();
    s.map.add(s.terrain.group);
    s.compMap = STAGE.pipeline(s.map, s.camMap, { flat: true, grain: 0.05, vig: 0.25 });
    return s;
  }

  /** 构图偏移：主体右移 dx 像素，左侧留出干净纸面给标注栏 @param {THREE.PerspectiveCamera} cam @param {number} dx */
  const frame = (cam, dx) => (dx ? cam.setViewOffset(W, H, -dx, 0, W, H) : cam.clearViewOffset());
  /** 标注栏右边界（文字右对齐到此，引线从这里伸向部件） */
  const COL = 600;

  /** 车轮转角：t0 前匀速，拉刹车后按指数衰减停下 */
  const wheelAngle = (t, tb, w0 = 3.2, c = 1.6) => t < tb ? -w0 * t : -w0 * (tb + (1 - Math.exp(-(t - tb) * c)) / c);

  SCENES[2] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, D = ch.vo_duration, full = ch.text;
      const a = (p) => vo + anchor(full, p, D);
      const sNo = a('可它根本没有'), sBrake = a('想减速'), sBlock = a('后来的版本'), sTrip = a('一八八八年'),
        sDown = a('一路下坡'), sCob = a('她只好'), sFirst = a('有人说'), end = ch.end - ch.start;
      const car = S.car;
      /** 每个镜头开头复位共享状态（转场时两个镜头会在同一帧先后绘制） */
      const prep = () => { S.comp.clip = []; showLine(S.f1, 0); showLine(S.f2, 0); car.drawing.fillAmount(1); };

      /** A：线稿生长 → 排线 */
      const shotA = (t) => {
        prep();
        const sw = easeInOut(prog(t, 0.1, sNo - 0.2));
        S.clip.normal.set(1, 0, 0); S.clip.constant = -lerp(1.9, -1.5, sw);
        S.comp.clip = sw < 1 ? [S.clip] : [];
        car.drawing.fillAmount(smooth(prog(t, sNo - 0.4, sNo + 1.6)));
        car.setLever(0); car.setBlock(0); car.spin(wheelAngle(t, 99));
        const az = lerp(1.05, 0.62, tail(prog(t, 0, sBrake)));
        const pos = STAGE.orbit([0.1, 0.55, 0], 6.4, az, 0.2);
        frame(S.cam, 0);
        STAGE.aim(S.cam, pos, [-0.35, 0.62, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '1886', 110, 230, pop(t, 0.3, 'heavy'), { size: 168, font: FONT_HEAD, color: INK, spacing: 6 });
        maskText(ctx, 'BENZ PATENT-MOTORWAGEN · DRP 37435', 116, 290, pop(t, 0.6, 'snap'), { size: 26, font: FONT_MONO, color: INK, spacing: 2 });
        maskText(ctx, '卡尔·本茨 · 公认的第一辆现代汽车', 116, 340, pop(t, 0.8, 'snap'), { size: 32, font: FONT_BODY, color: INK });
        maskText(ctx, '没有刹车踏板', 116, 920, pop(t, sNo, 'card'), { size: 76, font: FONT_HEAD, color: RED });
        const pp = easeInOut(prog(t, sNo + 0.2, sNo + 0.8));
        ctx.fillStyle = RED; ctx.fillRect(116, 944, 452 * pp, 6);
      };

      /** B：手拉杆 → 带式制动 */
      const shotB = (t) => {
        prep();
        const tp = sBrake + 1.1;
        car.setLever(0.42 * pop(t, tp, 'card'));
        car.setBlock(0);
        car.spin(wheelAngle(t, tp));
        const k = tail(prog(t, sBrake, sBlock));
        frame(S.cam, 380 * smooth(prog(t, sBrake, sBrake + 1.2)));
        STAGE.aim(S.cam, V([2.6, 1.5, 5.4], [1.75, 1.3, 3.3], k), V([-0.2, 0.6, 0], [-0.05, 0.78, 0.35], k), 30);
        const fk = easeInOut(prog(t, tp + 0.1, tp + 1.6));
        showLine(S.f1, fk * 2); showLine(S.f2, fk * 2 - 1);
        STAGE.draw(S.comp, T);
        const g = STAGE.projectLocal(car.lever, [0.04, 0.66, 0], S.cam), pl = STAGE.project([-0.02, 0.66, 0.22], S.cam);
        callout(ctx, g.x, g.y, COL, 380, '手拉杆', smooth(prog(t, sBrake + 0.4, sBrake + 1.2)), { color: INK, size: 48, font: FONT_HEAD, sub: 'HAND LEVER' });
        callout(ctx, pl.x, pl.y, COL, 720, '勒住副轴皮带轮', smooth(prog(t, tp + 1.2, tp + 2)), { color: RED, size: 48, font: FONT_HEAD, sub: 'BAND BRAKE · 带式制动' });
      };

      /** C：木制刹车块压在铁皮车轮上 */
      const shotC = (t) => {
        prep();
        const tb = sBlock + 0.9;
        car.setLever(0); car.setBlock(pop(t, tb, 'heavy')); car.spin(wheelAngle(t, tb, 2.2, 1.2));
        const k = tail(prog(t, sBlock, sTrip));
        frame(S.cam, 420);
        STAGE.aim(S.cam, V([1.3, 1.1, 3.0], [0.95, 0.95, 2.45], k), V([-0.45, 0.62, 0.62], [-0.3, 0.62, 0.62], k), 32);
        STAGE.draw(S.comp, T);
        const b = STAGE.projectLocal(car.block, [0, 0.08, 0], S.cam), w = STAGE.project([-0.7, 1.12, 0.62], S.cam);
        callout(ctx, b.x, b.y, COL, 420, '木头刹车块', smooth(prog(t, tb + 0.1, tb + 0.9)), { color: RED, size: 48, font: FONT_HEAD, sub: 'WOODEN BRAKE BLOCK' });
        callout(ctx, w.x, w.y, COL, 250, '铁皮车轮', smooth(prog(t, tb + 0.5, tb + 1.3)), { color: INK, size: 40, font: FONT_HEAD });
        maskText(ctx, '和马车', 116, 860, pop(t, a('和马车'), 'card'), { size: 64, font: FONT_HEAD, color: INK });
        maskText(ctx, '几乎一样', 116, 950, pop(t, a('和马车') + 0.1, 'card'), { size: 64, font: FONT_HEAD, color: INK });
      };

      /** F：鞋匠钉新皮 → 第一副刹车片 */
      const shotF = (t) => {
        prep();
        car.setLever(0); car.setBlock(1); car.spin(-3);
        const lk = pop(t, sCob + 0.8, 'card');
        car.leather.position.x = -0.054 - (1 - clamp(lk)) * 0.25;
        car.leather.visible = lk > 0.02;
        S.nails.forEach((n, i) => { const nk = pop(t, sCob + 1.6 + i * 0.25, 'snap'); n.visible = nk > 0.01; n.position.x = -0.065 - (1 - clamp(nk)) * 0.08; });
        const k = tail(prog(t, sCob, end));
        const near = prog(t, sFirst, end);
        frame(S.cam, 420);
        STAGE.aim(S.cam, V([0.75, 0.9, 2.1], [1.05, 1.0, 2.75], easeInOut(near)), [-0.25, 0.64, 0.62], lerp(30, 32, k));
        STAGE.draw(S.comp, T);
        const b = STAGE.projectLocal(car.block, [-0.054, 0.0, 0.04], S.cam);
        callout(ctx, b.x, b.y, COL, 380, '鞋匠钉上新皮面', smooth(prog(t, sCob + 1.0, sCob + 1.8)), { color: RED, size: 44, font: FONT_HEAD, sub: 'LEATHER LINING' });
        maskText(ctx, '世界上', 116, 840, pop(t, sFirst + 0.3, 'heavy'), { size: 72, font: FONT_HEAD, color: INK });
        maskText(ctx, '第一副刹车片？', 116, 940, pop(t, sFirst + 0.4, 'heavy'), { size: 72, font: FONT_HEAD, color: INK });
      };

      /** D/E：贝尔塔之旅，铜版画地形上路线逐段画出 */
      const shotMap = (t) => {
        const k = prog(t, sTrip, sCob);
        const rk = easeInOut(prog(t, sTrip + 0.6, sCob - 0.5));
        S.terrain.reveal(rk);
        const r = S.terrain.route, i = Math.min(r.length - 1, Math.floor(rk * (r.length - 1)));
        const head = r[i];
        const cx = lerp(-6, 6, easeInOut(k));
        const look = [cx, 0.8, 0.5];
        STAGE.aim(S.camMap, [cx - 2.0, lerp(11, 8.5, easeInOut(k)), 12.5], look, 40);
        STAGE.draw(S.compMap, T);
        const p0 = STAGE.project(r[0], S.camMap), p1 = STAGE.project(r[r.length - 1], S.camMap), ph = STAGE.project(head, S.camMap);
        [[0.24, 'HEIDELBERG'], [0.42, 'WIESLOCH'], [0.64, 'BRUCHSAL']].forEach(([rk0, name]) => {
          const q = STAGE.project(r[Math.round(rk0 * (r.length - 1))], S.camMap), k0 = prog(rk, rk0, rk0 + 0.02);
          if (rk < rk0) return;
          ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(q.x, q.y, 6 * clamp(k0), 0, Math.PI * 2); ctx.fill();
          maskText(ctx, name, q.x + 14, q.y + 34, smooth(prog(rk, rk0, rk0 + 0.06)), { size: 22, font: FONT_MONO, color: INK, spacing: 2 });
        });
        ctx.fillStyle = RED;
        ctx.beginPath(); ctx.arc(ph.x, ph.y, 9, 0, Math.PI * 2); ctx.fill();
        callout(ctx, p0.x, p0.y, p0.x + 60, p0.y - 90, '曼海姆', smooth(prog(t, sTrip + 0.4, sTrip + 1.2)), { color: INK, size: 38, font: FONT_HEAD });
        if (rk > 0.85) callout(ctx, p1.x, p1.y, p1.x - 60, p1.y - 90, '普福尔茨海姆', smooth(prog(rk, 0.85, 1)), { color: INK, size: 38, font: FONT_HEAD });
        maskText(ctx, '1888', 110, 200, pop(t, sTrip, 'heavy'), { size: 120, font: FONT_HEAD, color: INK, spacing: 4 });
        maskText(ctx, '贝尔塔·本茨 · 汽车史上第一次长途驾驶', 114, 262, pop(t, sTrip + 0.3, 'snap'), { size: 36, font: FONT_HEAD, color: INK });
        maskText(ctx, 'MANNHEIM → PFORZHEIM · 约 106 km · 路线示意', 114, 312, pop(t, sTrip + 0.5, 'snap'), { size: 24, font: FONT_MONO, color: INK, spacing: 1 });
        maskText(ctx, '一路下坡，皮面一次次磨穿', 114, 960, pop(t, sDown, 'card'), { size: 52, font: FONT_HEAD, color: RED });
      };

      sequence(ctx, t, [
        { t0: 0, f: shotA },
        { t0: sBrake, f: shotB, tr: 'zoom' },
        { t0: sBlock, f: shotC, tr: 'whip' },
        { t0: sTrip, f: shotMap, tr: 'wipe' },
        { t0: sCob, f: shotF, tr: 'zoom' },
      ]);
    },
  };
})();
