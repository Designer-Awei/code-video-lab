/**
 * 第 6 章 · 踏板的分寸
 * 金色放射线底、3D 踏板应力云图从蓝到红、标准对比柱、溃缩解锁。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, easeOut, easeInOut, pop, spring, maskText, sourceTag, card, sequence, grain, vignette, anchor, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const DARK = '#1F1A14', RED = '#B0281E', CYAN = '#1F6F86';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  const hand = (t) => [Math.sin(t * 1.1) * 0.01, Math.sin(t * 1.7 + 1) * 0.008, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  let S = null;

  /** 按局部 Y 给顶点写应力：踏面交接处最高，转轴次之 */
  function paintStress(mesh) {
    const pos = mesh.geometry.attributes.position;
    if (!pos) return;
    const arr = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      arr[i] = clamp(Math.exp(-(((y + 2.55) / 0.55) ** 2)) + 0.55 * Math.exp(-((y / 0.55) ** 2)));
    }
    mesh.geometry.setAttribute('aStress', new THREE.BufferAttribute(arr, 1));
  }

  function build() {
    const s = {};
    s.scene = new THREE.Scene();
    s.scene.background = STAGE.decoTexture();
    s.cam = STAGE.camera(30);
    s.comp = STAGE.pipeline(s.scene, s.cam, { bloom: [0.15, 0.35, 0.85], grain: 0.05, vig: 0.12, exposure: 1.15 });
    s.scene.add(new THREE.HemisphereLight(0xfff4e4, 0xc4a574, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 5, 6); s.scene.add(key);
    const fill = new THREE.DirectionalLight(0xf0d8b0, 0.8); fill.position.set(-4, 2, 3); s.scene.add(fill);
    s.pedal = M.pedal();
    s.stress = STAGE.stressMaterial();
    s.steel = [];
    s.pedal.meshes.forEach((m) => {
      paintStress(m);
      const tint = m.material.clone();
      const hex = m.material.color?.getHex?.() ?? 0;
      if (hex === 0x0e0f10) tint.color.set(0x8c4a32);
      else if (hex === 0x17181b) tint.color.set(m === s.pedal.pad ? 0xc4a574 : 0x5c6e80);
      else if (hex === 0x8b929b) { tint.color.set(0xe6ebf0); tint.metalness = 0.35; tint.roughness = 0.42; }
      else if (hex === 0x15161a) tint.color.set(0x1f6f86);
      else if (hex === 0x0c0c0d) tint.color.set(0xb0281e);
      s.steel.push(tint);
      m.material = s.stress;
    });
    s.pedal.group.traverse((o) => {
      if (o.isInstancedMesh && o.material?.color?.getHex?.() === 0x5d5a55) {
        o.material = o.material.clone();
        o.material.color.set(0xc9a25a);
      }
    });
    s.pedal.debris.material = s.pedal.debris.material.clone();
    s.pedal.debris.material.color.set(0xc9a25a);
    s.scene.add(s.pedal.group);
    s.fibers = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6), new THREE.MeshBasicMaterial({ color: 0x3fb6e8, toneMapped: false }), 80);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < 80; i++) {
      const col = i % 8, row = Math.floor(i / 8);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.08 * (row % 2 ? 1 : -1));
      p.set(-0.28 + col * 0.08, -2.55, -0.18 + row * 0.045);
      sc.set(1, 1, 1);
      mm.compose(p, q, sc);
      s.fibers.setMatrixAt(i, mm);
    }
    s.fibers.visible = false;
    s.pedal.arm.add(s.fibers);
    return s;
  }

  const frame = (dx) => (dx ? S.cam.setViewOffset(W, H, -dx, 0, W, H) : S.cam.clearViewOffset());
  const useSteel = (on) => S.pedal.meshes.forEach((m, i) => { m.material = on ? S.steel[i] : S.stress; });

  /** 应力色带图例 */
  function legend(ctx, x, y, k) {
    if (k <= 0) return;
    const g = ctx.createLinearGradient(x, 0, x + 280, 0);
    [[0, '#1e47d9'], [0.33, '#26bfc9'], [0.66, '#f2d933'], [1, '#eb3826']].forEach(([s, c]) => g.addColorStop(s, c));
    ctx.save(); ctx.globalAlpha = clamp(k);
    ctx.fillStyle = g; ctx.fillRect(x, y, 280, 10);
    ctx.restore();
    maskText(ctx, 'VON MISES', x, y - 12, k, { size: 20, font: FONT_MONO, color: DARK });
    maskText(ctx, 'LOW', x, y + 32, k, { size: 18, font: FONT_MONO, color: DARK });
    maskText(ctx, 'HIGH', x + 280, y + 32, k, { size: 18, font: FONT_MONO, color: RED, align: 'right' });
  }

  SCENES[6] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, D = ch.vo_duration, full = ch.text;
      const a = (s) => vo + anchor(full, s, D);
      const s21 = a('进入二十一世纪'), sReq = a('塑料不等于'), sHow = a('那么，一块踏板'), sGB = a('我国强制标准'), sQC = a('推荐性的行业'),
        sPeak = a('这次测试中'), sBut = a('当然'), sCrush = a('还有一点'), sLast = a('该断的时候');

      /** 左侧工艺小图标：钢板、冲压臂、焊上支架 */
      function stepIcon(ctx, x, y, i, k) {
        if (k <= 0) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = clamp(k);
        ctx.strokeStyle = DARK; ctx.fillStyle = RED;
        ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (i === 0) ctx.strokeRect(-40, -24, 80, 48);
        else if (i === 1) {
          ctx.beginPath(); ctx.moveTo(-6, -34); ctx.quadraticCurveTo(10, -6, 22, 34); ctx.lineTo(4, 34); ctx.quadraticCurveTo(-8, 0, -24, -34); ctx.closePath(); ctx.stroke();
        } else {
          ctx.strokeRect(-34, -36, 68, 24);
          ctx.beginPath(); ctx.moveTo(0, -12); ctx.quadraticCurveTo(8, 8, 16, 36); ctx.lineTo(0, 34); ctx.quadraticCurveTo(-4, 8, -8, -12); ctx.stroke();
          ctx.fillRect(-36, -14, 16, 6); ctx.fillRect(18, -14, 16, 6);
        }
        ctx.restore();
      }

      /** A：钢板冲压焊接。整只踏板落在右侧，左侧按工序长出来 */
      const shotSteel = (t) => {
        useSteel(true); S.fibers.visible = false;
        S.stress.uniforms.uLoad.value = 0;
        S.pedal.setPress(0.04); S.pedal.setBreak(0, 0);
        frame(440);
        const k = tail(prog(t, 0, s21));
        STAGE.aim(S.cam, add3(V([7.2, 2.6, 10.4], [6.2, 2.1, 9.0], k), hand(t)), [0.15, -0.35, 0.05], 26);
        STAGE.draw(S.comp, T);
        maskText(ctx, '钢板 · 冲压 · 焊接', 116, 200, pop(t, 0.4, 'heavy'), { size: 64, font: FONT_HEAD, color: DARK });
        maskText(ctx, '很长一段时间里，刹车踏板都是这样造出来的', 116, 268, pop(t, 1.1, 'card'), { size: 28, font: FONT_BODY, color: DARK });
        [['冷轧钢板', '一块平整的料'], ['冲压', '压出踏板臂和踏面'], ['焊接', '焊到支架上']].forEach(([h, sub], i) => {
          const st = 1.8 + i * 1.5, y = 420 + i * 150, pk = pop(t, st, 'card');
          maskText(ctx, `0${i + 1}`, 116, y, pop(t, st, 'snap'), { size: 28, font: FONT_MONO, color: RED });
          maskText(ctx, h, 190, y, pk, { size: 40, font: FONT_HEAD, color: DARK });
          maskText(ctx, sub, 190, y + 46, pop(t, st + 0.25, 'card'), { size: 24, font: FONT_BODY, color: DARK });
          stepIcon(ctx, 560, y - 8, i, pk);
        });
      };

      /** B：复合材料 + 应力云图 */
      const shotComp = (t) => {
        useSteel(false); S.fibers.visible = false;
        const load = easeInOut(prog(t, sReq, sReq + 2.4));
        S.stress.uniforms.uLoad.value = load;
        S.pedal.setPress(0.08 * load); S.pedal.setBreak(0, 0);
        const fk = pop(t, sReq - 0.2, 'card');
        S.fibers.material.opacity = clamp(fk); S.fibers.material.transparent = true;
        frame(360);
        const k = tail(prog(t, s21, sHow));
        STAGE.aim(S.cam, add3(V([3.2, -0.6, 4.6], [2.2, -1.4, 3.4], k), hand(t)), [0.2, -2.2, 0.2], 32);
        STAGE.draw(S.comp, T);
        maskText(ctx, '21 世纪', 116, 220, pop(t, s21, 'heavy'), { size: 88, font: FONT_HEAD, color: DARK });
        maskText(ctx, 'PA66-GF · 玻纤增强尼龙', 116, 290, pop(t, s21 + 0.4, 'snap'), { size: 32, font: FONT_MONO, color: CYAN });
        maskText(ctx, 'PORSCHE 918', 116, 400, pop(t, a('保时捷'), 'heavy'), { size: 56, font: FONT_MONO, color: DARK });
        maskText(ctx, '比钢制轻 30–50%', 116, 470, pop(t, a('比钢制'), 'card'), { size: 44, font: FONT_HEAD, color: CYAN });
        maskText(ctx, '塑料不等于脆弱', 116, 600, pop(t, sReq, 'heavy'), { size: 56, font: FONT_HEAD, color: RED });
        ['纤维怎么铺', '加强筋怎么排', '熔接痕落在哪里'].forEach((w, i) => {
          maskText(ctx, w, 116, 700 + i * 64, pop(t, a(['纤维怎么铺', '加强筋怎么排', '熔接痕落在'][i]), 'snap'), { size: 36, font: FONT_HEAD, color: i === 2 ? RED : DARK });
        });
        legend(ctx, 116, 960, pop(t, sReq, 'card'));
      };

      /** C：500 / 1500 / 1612 对比柱 + 标准截图 */
      const shotBars = (t) => {
        STAGE.paintDeco(ctx, W, H);
        const ask = '一块踏板该扛多大的力？';
        const fly = smooth(prog(t, sHow + 0.4, sGB));
        const askSize = lerp(108, 48, fly);
        ctx.save(); ctx.font = `${askSize}px ${FONT_HEAD}`; const askW = ctx.measureText(ask).width; ctx.restore();
        maskText(ctx, ask, lerp((W - askW) / 2, 116, fly), lerp(H / 2, 120, fly), t >= sHow ? 1 : 0, { size: askSize, font: FONT_HEAD, color: DARK });
        if (t > sBut) maskText(ctx, '台架静态加载  ≠  实车瞬间冲击', 116, 196, pop(t, sBut, 'heavy'), { size: 32, font: FONT_HEAD, color: RED });
        const showCards = t > sGB;
        if (showCards) {
          card(ctx, IMG.ndls_gb21670, 1520, 360, 560, -0.02, pop(t, sGB, 'card'), { from: [80, 40], rot0: 0.04 });
          card(ctx, IMG.yicai_pedal_force, 1520, 800, 560, 0.018, pop(t, sQC, 'card'), { from: [80, 40], rot0: -0.03 });
          maskText(ctx, '来源：国家标准全文公开系统 · 第一财经 · 2026', 116, 1052, 1, { size: 16, font: FONT_BODY, color: DARK });
        }
        const bars = [[500, 'GB 7258', '踏板力上限 · 强制', sGB, DARK], [1500, 'QC/T 788', '5 s × 5 次 · 推荐', sQC, CYAN], [1612, '本次峰值', '懂车帝实测断裂', sPeak, RED]];
        const bx = showCards ? 160 : 340, gap = showCards ? 280 : 420, base = 920, scale = 0.38;
        bars.forEach(([v, lab, sub, st, col], i) => {
          const p = spring(t - st, 10, 0.8);
          if (p <= 0) return;
          const h = v * scale * clamp(p, 0, 1.05), x = bx + i * gap;
          ctx.fillStyle = col; ctx.fillRect(x, base - h, 150, h);
          maskText(ctx, `${Math.round(v * clamp(p))} N`, x + 75, base - h - 20, clamp(p), { size: 48, font: FONT_MONO, color: DARK, align: 'center' });
          maskText(ctx, lab, x + 75, base + 48, clamp(p), { size: 28, font: FONT_HEAD, color: col, align: 'center' });
          maskText(ctx, sub, x + 75, base + 86, clamp(p), { size: 22, font: FONT_BODY, color: DARK, align: 'center' });
        });
        grain(ctx, T, 0.06); vignette(ctx, 0.45);
      };

      /**
       * 左侧溃缩三步的小图标：挤入、脱开、让开。
       * @param {CanvasRenderingContext2D} ctx
       * @param {number} x @param {number} y @param {number} i @param {number} k
       */
      function crushIcon(ctx, x, y, i, k) {
        if (k <= 0) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = clamp(k);
        ctx.strokeStyle = DARK;
        ctx.fillStyle = RED;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        if (i === 0) {
          ctx.strokeRect(-28, -18, 22, 36);
          ctx.beginPath();
          ctx.moveTo(8, 0); ctx.lineTo(28, 0);
          ctx.moveTo(18, -8); ctx.lineTo(28, 0); ctx.lineTo(18, 8);
          ctx.stroke();
        } else if (i === 1) {
          ctx.beginPath();
          ctx.moveTo(-30, -16); ctx.lineTo(-8, -16); ctx.lineTo(-4, 16); ctx.lineTo(-26, 16); ctx.closePath();
          ctx.moveTo(6, -16); ctx.lineTo(28, -16); ctx.lineTo(24, 16); ctx.lineTo(2, 16); ctx.closePath();
          ctx.stroke();
          ctx.fillRect(-2, -3, 4, 6);
        } else {
          ctx.beginPath();
          ctx.moveTo(12, -20); ctx.quadraticCurveTo(26, -2, 14, 18);
          ctx.moveTo(-24, 2); ctx.lineTo(-8, 14); ctx.lineTo(-18, 20);
          ctx.stroke();
        }
        ctx.restore();
      }

      /** D：溃缩解锁。踏板留在右侧，左侧中部按碰撞顺序长出三步 */
      const shotCrush = (t) => {
        useSteel(true); S.fibers.visible = false;
        S.stress.uniforms.uLoad.value = 0;
        const hit = easeOut(prog(t, a('主动溃缩'), a('主动溃缩') + 1.1));
        S.pedal.setPress(0.04);
        S.pedal.setBreak(hit, hit * 0.55, { absX: true, dir: 1, fly: 0.42 });
        frame(420);
        const k = tail(prog(t, sCrush, ch.end - ch.start));
        STAGE.aim(S.cam, add3(V([5.6, 1.25, 8.2], [5.0, 1.15, 7.4], k), hand(t)), [0.15, -0.7, 0.05], 26);
        STAGE.draw(S.comp, T);
        maskText(ctx, '不是越硬越好', 116, 180, pop(t, sCrush, 'heavy'), { size: 60, font: FONT_HEAD, color: DARK });
        maskText(ctx, '正面碰撞 · 主动溃缩', 116, 252, pop(t, a('主动溃缩'), 'card'), { size: 36, font: FONT_HEAD, color: CYAN });
        [
          ['前围板挤进来', '踏板会被推向小腿', a('被专门设计')],
          ['支架沿预定位置脱开', '销轴或弱化截面先让', a('主动溃缩')],
          ['踏板让开', '冲击不顶到腿上', a('主动溃缩') + 1.6],
        ].forEach(([h, sub, st], i) => {
          const y = 400 + i * 130, pk = pop(t, st, 'card');
          maskText(ctx, `0${i + 1}`, 116, y, pop(t, st, 'snap'), { size: 26, font: FONT_MONO, color: RED });
          maskText(ctx, h, 190, y, pk, { size: 36, font: FONT_HEAD, color: DARK });
          maskText(ctx, sub, 190, y + 42, pop(t, st + 0.2, 'card'), { size: 24, font: FONT_BODY, color: DARK });
          crushIcon(ctx, 620, y + 8, i, pk);
        });
        maskText(ctx, '该断的时候要断，', 116, 840, pop(t, sLast, 'heavy'), { size: 48, font: FONT_HEAD, color: DARK });
        maskText(ctx, '不该断的时候，一定不能断。', 116, 908, pop(t, sLast + 1.2, 'heavy'), { size: 44, font: FONT_HEAD, color: RED });
        maskText(ctx, '这就是一块踏板的分寸', 116, 990, pop(t, a('这就是'), 'card'), { size: 34, font: FONT_HEAD, color: DARK });
      };

      sequence(ctx, t, [
        { t0: 0, f: shotSteel },
        { t0: s21, f: shotComp, tr: 'wipe' },
        { t0: sHow, f: shotBars, tr: 'whip' },
        { t0: sCrush, f: shotCrush, tr: 'dip' },
      ]);
    },
  };
})();
