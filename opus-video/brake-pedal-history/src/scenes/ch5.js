/**
 * 第 5 章 · 快与稳（1953 勒芒 → DS → 双回路 → ABS）
 * 五十年代赛车海报：3D 卡通分层着色 + 墨线 + 网点后期；刹车盘烧红用自发光 + 辉光。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, easeInOut, pop, maskText, callout, anchor, sequence, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const CREAM = '#EFE4C8', GREEN = '#1F5F4A', RED = '#D9432B', NAVY = '#1B2A3A', YEL = '#E9B23C';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  const hand = (t) => [Math.sin(t * 1.1) * 0.012, Math.sin(t * 1.7 + 1) * 0.01, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const MC = [0.95, 0.12, 0.2];
  let S = null;

  /** 奶油底 + 左下角网点渐变 */
  function posterTexture() {
    return STAGE.canvasTexture(W, H, (g) => {
      g.fillStyle = CREAM; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(27,42,58,0.10)';
      for (let y = 0; y < H; y += 18) for (let x = (y / 18) % 2 * 9; x < W; x += 18) {
        const f = clamp(1 - Math.hypot(x / W, (H - y) / H) * 1.25);
        const r = f * 7;
        if (r > 0.6) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
      }
    });
  }

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
    s.scene.background = STAGE.decoTexture();
    s.cam = STAGE.camera(30);
    s.comp = STAGE.pipeline(s.scene, s.cam, { flat: true, ink: { color: 0x1b2a3a, width: 1.3 }, bloom: [0.9, 0.5, 1.05], halftone: { ink: 0x1b2a3a, cell: 8, levels: 48 }, grain: 0.04, vig: 0.1 });
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(3, 6, 5); s.scene.add(sun);
    const discMat = STAGE.toon(0x56606a); discMat.emissive = new THREE.Color(0, 0, 0);
    s.wheel = ME.ventDisc({ disc: discMat, caliper: STAGE.toon(0xd9432b), rim: STAGE.toon(0xd8d0bc), tire: STAGE.toon(0x1b2a3a) });
    s.scene.add(s.wheel.group);
    s.floor = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.12, 64), STAGE.toon(0x1f5f4a)); s.floor.position.y = -0.06;
    s.mush = ME.mushroom({ rubber: STAGE.toon(0x1b2a3a), base: STAGE.toon(0x9aa0a4) });
    s.ds = new THREE.Group(); s.ds.add(s.floor, s.mush.group); s.scene.add(s.ds);
    s.car = ME.chassis({ len: 4, track: 1.7, mat: STAGE.toon(0xd8d0bc), wheelMat: STAGE.toon(0x1b2a3a) });
    s.scene.add(s.car.group);
    const body = M.cyl([MC[0] - 0.22, MC[1], MC[2]], [MC[0] + 0.12, MC[1], MC[2]], 0.08, STAGE.toon(0x1b2a3a), 20); s.car.group.add(body);
    const glass = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false });
    s.pipes = routes(s.car.pos).map((p) => { const pp = ME.pipe(p, { r: 0.045, glass, fluid: 0xd9432b }); s.car.group.add(pp.group); return pp; });
    s.drip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), STAGE.toon(0xd9432b)); s.car.group.add(s.drip);
    s.puddle = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), STAGE.toon(0xd9432b)); s.puddle.rotation.x = -Math.PI / 2; s.car.group.add(s.puddle);
    return s;
  }

  function only(...gs) { [S.wheel.group, S.ds, S.car.group].forEach((g) => { g.visible = gs.includes(g); }); }
  const frame = (dx) => (dx ? S.cam.setViewOffset(W, H, -dx, 0, W, H) : S.cam.clearViewOffset());

  /** 名次牌 */
  function podium(ctx, x, y, label, k, hot) {
    if (k <= 0) return;
    const s = clamp(k, 0, 1.2);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = hot ? RED : NAVY; ctx.beginPath(); ctx.roundRect(-70, -90, 140, 120, 14); ctx.fill();
    ctx.restore();
    maskText(ctx, label, x, y + 4 * s, clamp(k), { size: 64, font: FONT_HEAD, color: CREAM, align: 'center' });
  }

  SCENES[5] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, D = ch.vo_duration, full = ch.text;
      const a = (s) => vo + anchor(full, s, D);
      const s53 = a('一九五三年'), sJag = a('捷豹C型车'), sStraight = a('在长直道尽头'), sWin = a('最终拿下'), sDS = a('两年后'),
        sBold = a('还做了一件'), sNoPedal = a('它没有传统'), sMush = a('地板上只有'), sTravel = a('行程不到'), sForce = a('刹车力度'),
        sNoStd = a('踏板长什么样'), sTurn = a('真正的转折'), sOne = a('早期只有一套'), sLeak = a('一处漏油'), sDual = a('于是双回路'),
        sFail = a('一套失效'), s68 = a('一九六八年'), sABS = a('十年后'), sPump = a('它会替你'), sSteer = a('让车轮不抱死');

      /** A：五十年代 · 勒芒通风盘重刹烧红 */
      const shotLM = (t) => {
        only(S.wheel.group);
        frame(330);
        const brakes = [sStraight + 0.3, sStraight + 1.5, sStraight + 2.7];
        let heat = 0, slow = 0;
        brakes.forEach((b) => { const d = t - b; if (d > 0) { heat = Math.max(heat, Math.exp(-d * 0.9) * (1 - Math.exp(-d * 8))); slow += 1 - Math.exp(-d * 3); } });
        heat = clamp(heat * 1.1);
        S.wheel.setHeat(heat);
        S.wheel.rotor.rotation.z = -(t * 9 - slow * 2.2);
        S.wheel.group.rotation.set(0, -0.45, 0);
        const k = tail(prog(t, 0, sDS));
        STAGE.aim(S.cam, add3(V([0.6, 0.4, 4.4], [1.0, 0.5, 3.4], k), hand(t)), [0.1, 0.05, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '五十年代', 110, 240, pop(t, 0.3, 'heavy') * (1 - smooth(prog(t, s53 - 0.4, s53))), { size: 104, font: FONT_HEAD, color: NAVY });
        maskText(ctx, '速度再一次逼近刹车的极限', 116, 320, pop(t, 1.0, 'card') * (1 - smooth(prog(t, s53 - 0.4, s53))), { size: 40, font: FONT_HEAD, color: RED });
        if (t > s53 - 0.4) {
          maskText(ctx, '1953', 110, 240, pop(t, s53, 'heavy'), { size: 150, font: FONT_HEAD, color: NAVY, spacing: 6 });
          maskText(ctx, 'LE MANS 24H', 116, 310, pop(t, s53 + 0.3, 'snap'), { size: 40, font: FONT_MONO, color: RED, spacing: 4 });
          maskText(ctx, '捷豹 C 型 × 邓禄普盘式刹车', 116, 400, pop(t, sJag, 'card'), { size: 44, font: FONT_HEAD, color: GREEN });
          maskText(ctx, '长直道尽头 · 一次次重刹', 116, 480, pop(t, sStraight, 'card'), { size: 40, font: FONT_HEAD, color: NAVY });
          maskText(ctx, '也不衰退', 116, 545, pop(t, sStraight + 2.0, 'card'), { size: 52, font: FONT_HEAD, color: RED });
        }
        ['1', '2', '4'].forEach((n, i) => podium(ctx, 190 + i * 170, 800, n, pop(t, sWin + 0.3 + i * 0.25, 'bouncy'), i < 2));
        maskText(ctx, '冠军 · 亚军 · 第四名', 116, 900, pop(t, sWin + 1.1, 'card'), { size: 36, font: FONT_HEAD, color: NAVY });
      };

      /** B：雪铁龙 DS 蘑菇头按钮 */
      const shotDS = (t) => {
        only(S.ds);
        frame(-300);
        const k0 = pop(t, sMush - 0.2, 'heavy');
        S.mush.group.visible = k0 > 0.02; S.mush.group.scale.setScalar(clamp(k0, 0, 1.08) * 1.6);
        const hits = [sTravel + 0.4, sForce + 0.3, sForce + 1.4];
        let press = 0;
        hits.forEach((h, i) => { const d = t - h; if (d > 0 && d < 1.0) press = Math.max(press, Math.sin(Math.PI * clamp(d / 0.9)) * (i === 2 ? 1 : 0.7)); });
        S.mush.setPress(press);
        S.ds.rotation.y = t * 0.15;
        const k = tail(prog(t, sDS, sNoStd));
        STAGE.aim(S.cam, add3(V([0, 2.2, 4.4], [0, 1.5, 3.4], k), hand(t)), [0, 0.3, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '1955', W - 110, 230, pop(t, sDS, 'heavy'), { size: 150, font: FONT_HEAD, color: NAVY, align: 'right', spacing: 6 });
        maskText(ctx, 'CITROËN DS', W - 116, 300, pop(t, sDS + 0.3, 'snap'), { size: 40, font: FONT_MONO, color: RED, align: 'right', spacing: 4 });
        maskText(ctx, '盘式刹车上量产车', W - 116, 380, pop(t, sDS + 0.8, 'card'), { size: 40, font: FONT_HEAD, color: GREEN, align: 'right' });
        maskText(ctx, '没有传统的刹车踏板', W - 116, 480, pop(t, sNoPedal, 'card'), { size: 48, font: FONT_HEAD, color: NAVY, align: 'right' });
        const cp = STAGE.projectLocal(S.mush.group, [0.2, 0.3, 0], S.cam);
        callout(ctx, cp.x, cp.y, 1300, 600, '蘑菇头按钮', pop(t, sMush + 0.3, 'card'), { color: RED, size: 48, font: FONT_HEAD });
        maskText(ctx, '行程 < 1 cm', W - 116, 760, pop(t, sTravel, 'heavy'), { size: 64, font: FONT_MONO, color: NAVY, align: 'right' });
        maskText(ctx, '看踩多用力，不看踩多深', W - 116, 850, pop(t, sForce, 'card'), { size: 48, font: FONT_HEAD, color: RED, align: 'right' });
        const fb = smooth(press);
        ctx.save(); ctx.fillStyle = NAVY; ctx.fillRect(W - 116 - 420, 890, 420, 14); ctx.fillStyle = RED; ctx.fillRect(W - 116 - 420, 890, 420 * fb * clamp(pop(t, sForce, 'snap')), 14); ctx.restore();
        if (t > sNoStd - 0.3) {
          const q = pop(t, sNoStd, 'heavy');
          ctx.save(); ctx.globalAlpha = clamp(q); STAGE.paintDeco(ctx, W, H); ctx.restore();
          maskText(ctx, '踏板长什么样', W / 2, 470, q, { size: 110, font: FONT_HEAD, color: NAVY, align: 'center' });
          maskText(ctx, '从来没有标准答案', W / 2, 610, pop(t, sNoStd + 0.5, 'heavy'), { size: 110, font: FONT_HEAD, color: RED, align: 'center' });
        }
      };

      /** C：单回路漏油 → 双回路 → 1968 法规 */
      const shotDual = (t) => {
        only(S.car.group);
        frame(260);
        const dual = t > sDual;
        const leak = smooth(prog(t, sLeak + 0.3, sLeak + 1.8)), fail = smooth(prog(t, sFail + 0.3, sFail + 1.6));
        const fillIn = easeInOut(prog(t, sOne, sOne + 1.4)), refill = easeInOut(prog(t, sDual + 0.2, sDual + 1.4));
        S.pipes.forEach((p, i) => {
          const front = i < 2;
          let f;
          if (!dual) f = fillIn * (1 - leak);
          else f = refill * (front ? 1 - fail : 1);
          p.fluid.uniforms.uFill.value = f * 1.02;
          p.fluid.uniforms.uTime.value = t;
          p.fluid.uniforms.uColor.value.set(dual && !front ? 0x1b5f9a : 0xd9432b);
        });
        const lp = S.pipes[dual ? 0 : 3].curve.getPointAt(0.55);
        const dropT = ((t - (dual ? sFail : sLeak)) * 1.4) % 1;
        const leaking = dual ? t > sFail && t < sFail + 2.4 : t > sLeak && t < sDual;
        S.drip.visible = leaking; S.drip.position.set(lp.x, lp.y - dropT * 0.5, lp.z);
        const pk = dual ? fail : leak;
        S.puddle.visible = (dual ? t > sFail : t > sLeak && t < sDual) && pk > 0.02; S.puddle.position.set(lp.x, -0.36, lp.z); S.puddle.scale.setScalar(Math.max(0.01, pk));
        S.car.group.rotation.set(0, 0, 0);
        const k = tail(prog(t, sTurn, sABS));
        STAGE.aim(S.cam, add3(V([3.6, 5.0, 4.4], [3.0, 4.3, 3.8], k), hand(t)), [0, -0.1, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '真正的转折', 110, 220, pop(t, sTurn, 'heavy'), { size: 88, font: FONT_HEAD, color: NAVY });
        maskText(ctx, '来自安全', 116, 300, pop(t, sTurn + 0.4, 'card'), { size: 48, font: FONT_HEAD, color: RED });
        if (!dual) {
          maskText(ctx, '单回路', 116, 440, pop(t, sOne, 'card'), { size: 60, font: FONT_HEAD, color: NAVY });
          maskText(ctx, '一处漏油', 116, 540, pop(t, sLeak, 'card'), { size: 52, font: FONT_HEAD, color: RED });
          maskText(ctx, '整车没了刹车', 116, 620, pop(t, sLeak + 1.4, 'heavy'), { size: 52, font: FONT_HEAD, color: RED });
        } else {
          maskText(ctx, '双回路', 116, 440, pop(t, sDual, 'heavy'), { size: 60, font: FONT_HEAD, color: NAVY });
          maskText(ctx, '一套失效', 116, 540, pop(t, sFail, 'card'), { size: 52, font: FONT_HEAD, color: RED });
          maskText(ctx, '另一套还能把车停住', 116, 620, pop(t, sFail + 1.4, 'heavy'), { size: 52, font: FONT_HEAD, color: '#1B5F9A' });
        }
        if (t > s68 - 0.2) {
          const st = pop(t, s68, 'heavy');
          const flash = t - s68 - 0.3;
          ctx.save(); ctx.translate(1380, 760); ctx.rotate(-0.12); ctx.scale(lerp(1.6, 1, clamp(st)), lerp(1.6, 1, clamp(st)));
          ctx.globalAlpha = clamp(st * 1.5);
          ctx.strokeStyle = RED; ctx.lineWidth = 8; ctx.strokeRect(-270, -110, 540, 220);
          ctx.lineWidth = 3; ctx.strokeRect(-256, -96, 512, 192);
          ctx.fillStyle = RED; ctx.font = `120px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.fillText('1968', 0, 20);
          ctx.font = `34px ${FONT_HEAD}`; ctx.fillText('写进美国联邦安全法规', 0, 76);
          ctx.restore();
          if (flash > 0 && flash < 0.07) { ctx.save(); ctx.globalAlpha = flash < 0.034 ? 0.6 : 0.2; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
        }
      };

      /** D：1978 电子 ABS，车轮点刹不抱死 */
      const shotABS = (t) => {
        only(S.wheel.group);
        frame(-320);
        S.wheel.setHeat(0);
        const on = t > sPump;
        const pulse = on ? (Math.sin((t - sPump) * Math.PI * 2 * 6) > 0 ? 1 : 0) : 0;
        const base = t * 6 - Math.max(0, t - sPump) * 3.5;
        S.wheel.rotor.rotation.z = -(base + pulse * 0.05);
        S.wheel.group.rotation.set(0, 0.5, 0);
        const k = tail(prog(t, sABS, ch.end - ch.start));
        STAGE.aim(S.cam, add3(V([-0.4, 0.4, 4.4], [-0.6, 0.5, 3.6], k), hand(t)), [-0.05, 0.05, 0], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '1978', W - 110, 230, pop(t, sABS, 'heavy'), { size: 150, font: FONT_HEAD, color: NAVY, align: 'right', spacing: 6 });
        maskText(ctx, 'BOSCH × MERCEDES-BENZ', W - 116, 300, pop(t, sABS + 0.3, 'snap'), { size: 34, font: FONT_MONO, color: RED, align: 'right', spacing: 2 });
        maskText(ctx, '电子 ABS', W - 116, 390, pop(t, sABS + 0.7, 'heavy'), { size: 64, font: FONT_HEAD, color: GREEN, align: 'right' });
        const gw = 400, gx = W - 116 - gw, gy = 640, gh = 120;
        const gk = pop(t, sPump - 0.4, 'card');
        if (gk > 0) {
          ctx.save(); ctx.globalAlpha = clamp(gk);
          ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
          ctx.strokeStyle = RED; ctx.lineWidth = 4; ctx.beginPath();
          const span = 2.0, now = t - sPump;
          for (let i = 0; i <= 240; i++) {
            const u = i / 240, tt = now - span * (1 - u);
            const v = tt < 0 ? 0 : (Math.sin(tt * Math.PI * 2 * 6) > 0 ? 1 : 0.35);
            const x = gx + u * gw, y = gy + gh - v * gh;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke(); ctx.restore();
          maskText(ctx, '制动压力', gx, gy - 20, clamp(gk), { size: 28, font: FONT_HEAD, color: NAVY });
        }
        maskText(ctx, '一秒钟 · 松开、踩下很多次', W - 116, 840, pop(t, sPump, 'card'), { size: 44, font: FONT_HEAD, color: NAVY, align: 'right' });
        maskText(ctx, '车轮不抱死 · 方向还能打', W - 116, 930, pop(t, sSteer, 'heavy'), { size: 56, font: FONT_HEAD, color: RED, align: 'right' });
      };

      sequence(ctx, t, [
        { t0: 0, f: shotLM },
        { t0: sDS, f: shotDS, tr: 'whip' },
        { t0: sTurn, f: shotDual, tr: 'wipe' },
        { t0: sABS, f: shotABS, tr: 'zoom' },
      ]);
      void sBold;
    },
  };
})();
