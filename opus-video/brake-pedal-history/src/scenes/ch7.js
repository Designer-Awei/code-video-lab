/**
 * 第 7 章 · 踏板变成信号
 * 金色放射线底：实体底盘 + 中枢盒子按年代形变 + 青色信号脉冲跑向四个车轮。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, easeOut, pop, maskText, sequence, anchor, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const DARK = '#1F1A14', CYAN = '#1F6F86', RED = '#B0281E', AMBER = '#8A5A12';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  const hand = (t) => [Math.sin(t * 1.1) * 0.01, Math.sin(t * 1.7 + 1) * 0.008, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const MILESTONES = [['2001', 'SBC'], ['2013', 'iBooster'], ['2016', 'MK C1'], ['2026', 'EMB']];
  let S = null;

  function routes(pos) {
    const HUB = [0.2, 0.18, 0];
    return pos.map(([x, z]) => [HUB, [x * 0.35, 0.12, z * 0.4], [x, 0.08, z - Math.sign(z) * 0.28]]);
  }

  function build() {
    const s = {};
    s.scene = new THREE.Scene();
    s.scene.background = STAGE.decoTexture();
    s.cam = STAGE.camera(30);
    s.comp = STAGE.pipeline(s.scene, s.cam, { flat: true, ink: { color: 0x1f1a14, width: 1.2 }, grain: 0.05, vig: 0.1 });
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(4, 7, 5); s.scene.add(key);
    const mat = STAGE.toon(0xc9a25a), wm = STAGE.toon(0x3a3128);
    s.car = ME.chassis({ len: 4, track: 1.7, mat, wheelMat: wm });
    s.scene.add(s.car.group);
    s.hub = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.42), STAGE.toon(0x4fe3f0));
    s.hub.position.set(0.2, 0.22, 0); s.car.group.add(s.hub);
    const glass = new THREE.MeshBasicMaterial({ color: 0x4fe3f0, transparent: true, opacity: 0.12, depthWrite: false });
    s.pipes = routes(s.car.pos).map((p) => { const pp = ME.pipe(p, { r: 0.03, glass, fluid: 0x4fe3f0 }); s.car.group.add(pp.group); return pp; });
    s.sig = ME.pulses(24, 0x4fe3f0); s.car.group.add(s.sig.points);
    s.motors = s.car.pos.map(([x, z]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0x4fe3f0, toneMapped: false }));
      m.position.set(x, 0.08, z - Math.sign(z) * 0.24); m.visible = false; s.car.group.add(m); return m;
    });
    s.pedal = M.pedal();
    s.pedal.group.rotation.y = Math.PI / 2;
    s.pedal.group.scale.setScalar(0.419);
    s.pedal.group.position.set(-2.585, 0.846, 2.158);
    s.pedal.meshes.forEach((m) => {
      const hex = m.material.color?.getHex?.() ?? 0;
      if (hex === 0x0c0c0d) { m.visible = false; return; }
      let col = null;
      if (hex === 0x0e0f10) col = 0x8c4a32;
      else if (hex === 0x17181b) col = m === s.pedal.pad ? 0xc4a574 : 0x3d6a8c;
      else if (hex === 0x8b929b) col = 0xd5dbe2;
      else if (hex === 0x15161a) col = 0x3aa0b8;
      else if (hex === 0xdfe3e8) col = 0xc9a25a;
      if (col != null) m.material = STAGE.toon(col);
    });
    s.pedal.group.traverse((o) => { if (o.isInstancedMesh) o.material = STAGE.toon(0xc9a25a); });
    s.scene.add(s.pedal.group);
    s.dash = s.pipes.map((p) => p.curve);
    return s;
  }

  const frame = (dx) => (dx ? S.cam.setViewOffset(W, H, -dx, 0, W, H) : S.cam.clearViewOffset());

  SCENES[7] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, D = ch.vo_duration, full = ch.text;
      const a = (s) => vo + anchor(full, s, D);
      const phases = [a('二零零一年'), a('二零一三年'), a('二零一六年'), a('而今年')];
      const sRecall = a('两次大规模'), sSim = a('工程师甚至'), sWire = a('传出去的只是');
      const ph = phases.filter((p) => t >= p).length - 1;

      /** A：章题。底盘让到右侧，左上角标题单独占一列 */
      const shotOpen = (t) => {
        frame(420);
        S.pedal.group.visible = false;
        S.pedal.setPress(0);
        S.hub.scale.set(1, 1, 1);
        S.pipes.forEach((p) => { p.fluid.uniforms.uFill.value = 0; });
        S.motors.forEach((m) => { m.visible = false; });
        const k = tail(prog(t, 0, phases[0]));
        STAGE.aim(S.cam, add3(V([0.9, 5.8, 5.6], [0.7, 5.2, 5.0], k), hand(t)), [0.55, 0.05, 0], 34);
        STAGE.draw(S.comp, T);
        maskText(ctx, '电动车时代', 116, 240, pop(t, 0.3, 'heavy'), { size: 88, font: FONT_HEAD, color: DARK });
        maskText(ctx, '踏板的身份正在改变', 116, 330, pop(t, 1.0, 'card'), { size: 40, font: FONT_HEAD, color: CYAN });
      };

      /** B：四个年代，中枢形变 */
      const shotEra = (t) => {
        const p = Math.max(0, ph);
        const lt = t - phases[p];
        const hydraulic = p < 3;
        frame(240);
        S.pedal.group.visible = true;
        S.pedal.setPress(0.12 + 0.08 * Math.sin(t * 1.6));
        const morph = pop(t, phases[p], 'heavy');
        const sizes = [[0.9, 0.7, 0.8], [1.1, 0.85, 0.9], [1.45, 1.05, 1.15], [0.7, 0.55, 0.65]];
        const sz = sizes[p];
        S.hub.scale.set(sz[0] * lerp(0.6, 1, clamp(morph)), sz[1] * lerp(0.6, 1, clamp(morph)), sz[2]);
        S.hub.material.color.set(p === 3 ? 0x4fe3f0 : 0xb8c7dc);
        const fill = hydraulic ? easeOut(prog(lt, 0.2, 1.6)) : 0;
        S.pipes.forEach((pp, i) => {
          pp.fluid.uniforms.uFill.value = fill;
          pp.fluid.uniforms.uTime.value = t;
          pp.fluid.uniforms.uColor.value.set(hydraulic ? 0xff5a47 : 0x4fe3f0);
          pp.group.children[0].visible = hydraulic || p === 3;
        });
        S.motors.forEach((m, i) => {
          const kk = pop(t, phases[3] + 1.2 + i * 0.12, 'snap');
          m.visible = p === 3 && kk > 0.02;
          m.scale.setScalar(clamp(kk, 0, 1.2));
        });
        S.sig.place(S.dash, t, 0.42, p === 3 ? easeOut(prog(lt, 0.4, 2.0)) : 1);
        STAGE.aim(S.cam, add3([3.5, 5.6, 5.0], hand(t)), [0.35, 0.55, 0], 34);
        STAGE.draw(S.comp, T);

        MILESTONES.forEach(([y, n], i) => {
          const x = 116 + i * 168, on = i <= p;
          maskText(ctx, y, x, 108, pop(t, (phases[i] || 0) - 0.1, 'snap'), { size: 26, font: FONT_MONO, color: i === p ? CYAN : (on ? DARK : 'rgba(31,26,20,0.35)') });
          maskText(ctx, n, x, 142, pop(t, (phases[i] || 0), 'snap'), { size: 22, font: FONT_HEAD, color: on ? DARK : 'rgba(31,26,20,0.3)' });
        });
        const head = [
          ['奔驰 SL · 电子液压制动', '踏板第一次变成传感器'],
          ['博世 iBooster', '电机取代真空助力 · 保留液压退路'],
          ['大陆 MK C1 · Alfa Romeo Giulia', '助力 / ABS / ESC 集成进一个盒子'],
          ['电子机械制动 EMB', '0 滴制动液 · 四个电机卡钳'],
        ][p];
        maskText(ctx, head[0], 116, 280, pop(t, phases[p], 'card'), { size: 40, font: FONT_HEAD, color: DARK });
        maskText(ctx, head[1], 116, 340, pop(t, phases[p] + 0.4, 'card'), { size: 32, font: FONT_HEAD, color: p === 3 ? CYAN : DARK });
        if (p === 0 && t > sRecall) {
          const k0 = pop(t, sRecall, 'heavy');
          ctx.save(); ctx.translate(420, 900); ctx.rotate(-0.1); ctx.scale(lerp(1.5, 1, clamp(k0)), lerp(1.5, 1, clamp(k0)));
          ctx.globalAlpha = clamp(k0 * 2); ctx.strokeStyle = RED; ctx.lineWidth = 6; ctx.strokeRect(-200, -70, 400, 130);
          ctx.restore();
          maskText(ctx, '召回 × 2', 420, 920, k0, { size: 64, font: FONT_HEAD, color: RED, align: 'center' });
        }
        if (p === 1) maskText(ctx, '机械液压连接 · 最后的退路', 116, 900, pop(t, a('依然保留'), 'card'), { size: 36, font: FONT_HEAD, color: AMBER });
        if (p === 3) {
          maskText(ctx, '传出去的只是一串电信号', 116, 888, pop(t, sWire, 'card'), { size: 40, font: FONT_HEAD, color: CYAN });
          maskText(ctx, '踏板感觉模拟器', 116, 968, pop(t, sSim, 'heavy'), { size: 48, font: FONT_HEAD, color: AMBER });
        }
      };

      sequence(ctx, t, [
        { t0: 0, f: shotOpen },
        { t0: phases[0] - 0.4, f: shotEra, tr: 'wipe' },
      ]);
    },
  };
})();
