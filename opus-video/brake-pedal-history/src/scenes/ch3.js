/**
 * 第 3 章 · 从手到脚（约 1896–1908）
 * 金色放射线底 + 卡通实体零件：维洛车轮、盘式/鼓式爆炸图、T 型车三踏板。受力部件涂红。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, pop, maskText, callout, anchor, sequence, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const CREAM = '#F2E6CF', GOLD = '#B8893A', DARK = '#1F1A14', RED = '#B0281E';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  const hand = (t) => [Math.sin(t * 1.1) * 0.01, Math.sin(t * 1.7 + 1) * 0.008, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  let S = null;

  function build() {
    const s = {};
    s.scene = new THREE.Scene();
    s.scene.background = STAGE.decoTexture();
    s.cam = STAGE.camera(30);
    s.comp = STAGE.pipeline(s.scene, s.cam, { flat: true, ink: { color: 0x1f1a14, width: 1.4 }, grain: 0.05, vig: 0.1 });
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 4); s.scene.add(sun);
    s.velo = ME.velo(); s.scene.add(s.velo.group);
    s.armHand = ME.arrow(STAGE.toon(0x1f1a14), 0.018); s.armFoot = ME.arrow(STAGE.toon(0xb0281e), 0.03);
    s.scene.add(s.armHand, s.armFoot);
    s.disc = ME.discBrake(); s.drum = ME.drumBrake();
    s.scene.add(s.disc.group, s.drum.group);
    s.t = ME.modelT(); s.scene.add(s.t.group);
    return s;
  }

  /** 只显示当前镜头需要的组 */
  function only(...gs) { [S.velo.group, S.armHand, S.armFoot, S.disc.group, S.drum.group, S.t.group].forEach((g) => { g.visible = gs.includes(g); }); }
  const frame = (dx) => (dx ? S.cam.setViewOffset(W, H, -dx, 0, W, H) : S.cam.clearViewOffset());

  /** 车轮旁的速度弧线（2D），sp 为速度 0..1 */
  function speedArcs(ctx, cx, cy, r, sp, t) {
    ctx.save();
    ctx.strokeStyle = DARK; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a0 = -t * (2 + sp * 9) + i * 1.26, len = 0.25 + sp * 0.55, rr = r * (1.1 + i * 0.045);
      ctx.globalAlpha = 0.18 + sp * 0.5; ctx.lineWidth = 2 + sp * 2;
      ctx.beginPath(); ctx.arc(cx, cy, rr, a0, a0 + len); ctx.stroke();
    }
    ctx.restore();
  }

  SCENES[3] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, D = ch.vo_duration, full = ch.text;
      const a = (s) => vo + anchor(full, s, D);
      const sFast = a('车却越跑越快'), sVelo = a('十九世纪末'), sTight = a('用脚去勒紧'), sLeg = a('腿的力量'), sFoot = a('刹车的主角'),
        sDisc = a('一九零二年'), sDrum = a('同一时期'), sT = a('一九零八年'), sThree = a('它的脚下'), sRight = a('最右边那块'),
        sBand = a('刹的却不是'), sMech = a('踏板、杠杆'), sEra = a('那是一个');

      /** A：手的力气有限，车轮越转越快 */
      const shotHand = (t) => {
        only(S.velo.group);
        frame(380);
        const sp = smooth(prog(t, 0.3, sVelo));
        S.velo.setPress(0); S.velo.spin(-(t * 4 + 5 * sp * sp * t));
        const k = tail(prog(t, 0, sVelo + 1));
        STAGE.aim(S.cam, add3(V([1.2, 0.5, 3.6], [0.8, 0.3, 2.8], k), hand(t)), [0.15, 0, 0], 30);
        STAGE.draw(S.comp, T);
        const c = STAGE.project([0, 0, 0], S.cam), e = STAGE.project([0.62, 0, 0], S.cam);
        speedArcs(ctx, c.x, c.y, Math.hypot(e.x - c.x, e.y - c.y), sp, t);
        maskText(ctx, '手的力气', 116, 470, pop(t, 0.3, 'heavy'), { size: 96, font: FONT_HEAD, color: DARK });
        maskText(ctx, '终究有限', 116, 580, pop(t, 0.6, 'heavy'), { size: 96, font: FONT_HEAD, color: DARK });
        maskText(ctx, '车却越跑越快', 116, 720, pop(t, sFast, 'heavy'), { size: 64, font: FONT_HEAD, color: RED });
      };

      /** A2：维洛车脚踏制动带 */
      const shotVelo = (t) => {
        only(S.velo.group, S.armHand, S.armFoot);
        frame(380);
        const tp = sTight + 0.4, pk = clamp(pop(t, tp, 'heavy'));
        S.velo.setPress(pk);
        const w0 = 9, stop = t > tp ? (1 - Math.exp(-(t - tp) * 1.6)) / 1.6 : 0;
        S.velo.spin(-(Math.min(t, tp) * w0 + w0 * stop));
        const hot = pk > 0.05;
        ME.paint(S.velo.pedal, hot); ME.paint(S.velo.band, hot); ME.paint(S.velo.rod, hot);
        S.armHand.rotation.z = Math.PI; S.armHand.position.set(1.08, 0.62, 0.13); S.armHand.userData.set(0.2 * pop(t, sLeg, 'snap'));
        S.armFoot.rotation.z = Math.PI; S.armFoot.position.set(0.86, 0.72, 0.13); S.armFoot.userData.set(0.56 * pop(t, sLeg + 0.3, 'heavy'));
        const k = tail(prog(t, sVelo, sDisc));
        STAGE.aim(S.cam, add3(V([2.0, 0.8, 3.4], [1.7, 0.6, 3.1], k), hand(t)), V([0.35, 0.15, 0.1], [0.55, 0.22, 0.1], k), 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '约 1896', 110, 210, pop(t, sVelo, 'heavy'), { size: 128, font: FONT_HEAD, color: DARK, spacing: 4 });
        maskText(ctx, 'BENZ VELO · 脚踏制动带', 116, 268, pop(t, sVelo + 0.3, 'snap'), { size: 30, font: FONT_MONO, color: DARK, spacing: 2 });
        const bp = STAGE.project([Math.cos(2.4) * 0.2, Math.sin(2.4) * 0.2, 0.13], S.cam), pp = STAGE.projectLocal(S.velo.pedal, [0.25, 0.36, 0.06], S.cam);
        callout(ctx, bp.x, bp.y, 560, 470, '制动带', pop(t, sTight, 'card'), { color: RED, size: 48, font: FONT_HEAD, sub: 'BRAKE BAND' });
        callout(ctx, pp.x, pp.y, pp.x + 90, pp.y + 170, '脚踏板', pop(t, sTight + 0.5, 'card'), { color: RED, size: 48, font: FONT_HEAD, sub: 'FOOT PEDAL' });
        const ah = STAGE.project([1.08, 0.66, 0.13], S.cam), af = STAGE.project([0.86, 0.76, 0.13], S.cam);
        maskText(ctx, '手', ah.x, ah.y - 10, pop(t, sLeg + 0.2, 'snap'), { size: 34, font: FONT_HEAD, color: DARK, align: 'center' });
        maskText(ctx, '腿', af.x, af.y - 10, pop(t, sLeg + 0.5, 'snap'), { size: 44, font: FONT_HEAD, color: RED, align: 'center' });
        maskText(ctx, '刹车的主角，换成了脚', 116, 940, pop(t, sFoot, 'heavy'), { size: 64, font: FONT_HEAD, color: DARK });
      };

      /** B：盘式 vs 鼓式爆炸图 */
      const shotDisc = (t) => {
        only(S.disc.group, S.drum.group);
        frame(0);
        S.disc.group.position.set(-1.3, 0, 0); S.drum.group.position.set(1.3, 0, 0);
        const breath = 0.06 * Math.sin(t * 1.4) * smooth(prog(t, sDisc + 2, sDisc + 3));
        const dk = (i) => clamp(pop(t, sDisc + 0.6 + i * 0.12, 'card')) * (1 - breath);
        S.disc.explode([dk(0), dk(1), dk(2)]);
        const rk = (i) => clamp(pop(t, sDrum + 0.5 + i * 0.12, 'card')) * (1 - breath);
        S.drum.explode([rk(0), rk(1), rk(2)]);
        S.disc.group.rotation.set(0.15, 0.85 + Math.sin(t * 0.3) * 0.06, 0);
        S.drum.group.rotation.set(0.15, -0.85 + Math.sin(t * 0.3 + 1) * 0.06, 0);
        const ka = pop(t, sDisc - 0.2, 'heavy'), kb = pop(t, sDrum - 0.3, 'heavy');
        S.disc.group.visible = ka > 0.02; S.disc.group.scale.setScalar(clamp(ka, 0, 1.05));
        S.drum.group.visible = kb > 0.02; S.drum.group.scale.setScalar(clamp(kb, 0, 1.05));
        ME.paint(S.disc.parts[3], true);
        S.drum.shoes.forEach((m) => ME.paint(m, true));
        const k = tail(prog(t, sDisc, sT));
        STAGE.aim(S.cam, add3(V([0, 1.1, 7.0], [0, 0.8, 6.2], k), hand(t)), [0, 0.2, 0], 32);
        STAGE.draw(S.comp, T);
        maskText(ctx, '1902', 110, 200, pop(t, sDisc, 'heavy'), { size: 128, font: FONT_HEAD, color: DARK, spacing: 4 });
        const pd = STAGE.project([-1.3, 0, 0], S.cam), pr = STAGE.project([1.3, 0, 0], S.cam);
        maskText(ctx, '盘式制动', pd.x, 900, pop(t, sDisc + 0.4, 'card'), { size: 52, font: FONT_HEAD, color: DARK, align: 'center' });
        maskText(ctx, 'LANCHESTER 专利 · 英国', pd.x, 952, pop(t, sDisc + 0.6, 'snap'), { size: 26, font: FONT_MONO, color: DARK, align: 'center' });
        maskText(ctx, '鼓式制动', pr.x, 900, pop(t, sDrum + 0.3, 'card'), { size: 52, font: FONT_HEAD, color: DARK, align: 'center' });
        maskText(ctx, '同一时期逐渐成形', pr.x, 952, pop(t, sDrum + 0.5, 'snap'), { size: 26, font: FONT_BODY, color: DARK, align: 'center' });
      };

      /** C：福特 T 型车三踏板 */
      const shotT = (t) => {
        only(S.t.group);
        frame(0);
        S.t.pedals.forEach((p, i) => { const k = pop(t, sThree + i * 0.13, 'card'); p.visible = k > 0.02; p.scale.setScalar(clamp(k, 0, 1.05)); });
        S.t.setPedal(0, 0); S.t.setPedal(1, 0);
        const press = clamp(pop(t, sRight + 0.6, 'heavy'));
        S.t.setPedal(2, press);
        S.t.setHand(0);
        ME.paint(S.t.pedals[2], press > 0.05);
        ME.paint(S.t.band, t > sBand);
        const mech = [sMech, a('杠杆'), a('拉杆')];
        S.t.rods.forEach((r, i) => ME.paint(r, t > mech[i + 1]));
        const k = tail(prog(t, sT, sBand)), kk = smooth(prog(t, sBand - 0.3, sBand + 1.6));
        const pos = V(V([-2.4, 1.9, 3.6], [-1.9, 1.5, 3.0], k), [1.3, 1.9, 2.0], kk);
        STAGE.aim(S.cam, add3(pos, hand(t)), V([0.05, 0.1, -0.5], [0.25, -0.05, -0.85], kk), 32);
        STAGE.draw(S.comp, T);
        const hk = Math.min(pop(t, sT, 'heavy'), 1 - smooth(prog(t, sBand - 0.3, sBand + 0.3)));
        maskText(ctx, '1908', 110, 210, hk, { size: 128, font: FONT_HEAD, color: DARK, spacing: 4 });
        maskText(ctx, 'FORD MODEL T · 千家万户', 116, 268, Math.min(pop(t, sT + 0.3, 'snap'), hk), { size: 30, font: FONT_MONO, color: DARK, spacing: 2 });
        const labels = ['离合 / 低速', '倒挡', '刹车'];
        const fade = 1 - smooth(prog(t, sBand - 0.3, sBand));
        if (fade > 0) {
          ctx.save(); ctx.globalAlpha = fade;
          S.t.pedals.forEach((p, i) => {
            const q = STAGE.projectLocal(p, [0, -0.8, 0.64], S.cam);
            maskText(ctx, labels[i], q.x, q.y + 78, pop(t, sThree + 0.5 + i * 0.3, 'card'), { size: i === 2 ? 46 : 36, font: FONT_HEAD, color: i === 2 ? RED : DARK, align: 'center' });
          });
          ctx.restore();
        }
        const q = STAGE.project([0.35, 0.45, -0.9], S.cam);
        callout(ctx, q.x, q.y, 1460, 168, '变速箱里的制动带', pop(t, sBand + 0.6, 'card'), { color: RED, size: 40, font: FONT_HEAD, sub: '刹的不是车轮' });
        ['踏板', '杠杆', '拉杆'].forEach((w, i) => maskText(ctx, w, 116 + i * 150, 900, pop(t, mech[i], 'snap'), { size: 56, font: FONT_HEAD, color: RED }));
        maskText(ctx, '纯机械的年代', 116, 980, pop(t, sEra, 'heavy'), { size: 48, font: FONT_HEAD, color: DARK });
      };

      sequence(ctx, t, [
        { t0: 0, f: shotHand },
        { t0: sVelo, f: shotVelo, tr: 'zoom' },
        { t0: sDisc, f: shotDisc, tr: 'wipe' },
        { t0: sT, f: shotT, tr: 'whip' },
      ]);
    },
  };
})();
