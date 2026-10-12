/**
 * 第 1 章 · 冷开场：一声“啪”（2026）
 * 电影级 CGI + 取证 HUD：程序化 3D 踏板总成、真实截图纸片、断裂慢放、片名光扫成铜版画。
 * 镜头分段见 storyboard_v2.md「冷开场逐秒」。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, easeIn, easeOut, easeInOut, spring, pop, maskText, sourceTag, anchor, rng,
    card, sequence, grain, vignette, FONT_MONO, FONT_HEAD, FONT_BODY } = L;
  const RED = '#E8412C', FG = '#C9CED6';
  const V = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  /** 长尾缓动：前 20% 时间走完约 80% 路程 */
  const tail = (k) => 1 - Math.pow(1 - clamp(k), 4);
  /** 手持噪声 */
  const hand = (t, a = 1) => [a * (Math.sin(t * 1.3) * 0.012 + Math.sin(t * 2.9 + 1) * 0.006), a * (Math.sin(t * 1.7 + 2) * 0.01 + Math.sin(t * 3.3) * 0.005), 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

  /** 力-时间曲线：峰值 1612N 在 0.82 */
  const forceAt = (k) => k < 0.82 ? 1612 * Math.pow(k / 0.82, 1.6) : 1612 * Math.exp(-(k - 0.82) * 30);

  let S = null;

  /** 建 3D 场景 */
  function build() {
    const s = {};
    // —— 脚坑 + 踏板
    s.well = new THREE.Scene();
    s.well.background = new THREE.Color(0x060708);
    s.well.environment = STAGE.envRoom;
    s.well.environmentIntensity = 0.5;
    s.camWell = STAGE.camera(32);
    s.pedal = M.pedal();
    s.foot = M.footwell();
    s.dust = M.dust(420, [-3, -3.6, -1.2], [3.5, 1.6, 3.5], 31);
    s.well.add(s.pedal.group, s.foot.group, s.dust.points);
    s.key = new THREE.SpotLight(0xfff3e6, 0, 0, 0.32, 0.5, 1.2);
    s.key.castShadow = true; s.key.shadow.mapSize.set(2048, 2048); s.key.shadow.bias = -0.0004; s.key.shadow.normalBias = 0.02;
    s.key.target.position.set(0, -1.4, 0.3);
    s.well.add(s.key, s.key.target);
    s.rim = new THREE.SpotLight(0xa8c0e0, 90, 0, 0.5, 0.8, 1.2); s.rim.position.set(-3.5, 2.5, -1.2); s.rim.target.position.set(0, -1, 0); s.well.add(s.rim, s.rim.target);
    s.kick = new THREE.PointLight(0xffd2a8, 6, 6, 2); s.kick.position.set(2.2, -3.2, 2.2); s.well.add(s.kick);
    s.fill = new THREE.HemisphereLight(0x8090a0, 0x050505, 0.12); s.well.add(s.fill);
    s.redLight = new THREE.PointLight(0xff3a1e, 0, 3, 2); s.redLight.position.set(0.6, 0.62, -0.2); s.well.add(s.redLight);
    s.cWell = STAGE.pipeline(s.well, s.camWell, { dof: STAGE.LITE ? null : { aperture: 0.0035, maxblur: 0.007 }, bloom: [0.4, 0.35, 1.1], grain: 0.065, vig: 0.6 });

    // —— 片名：转台 + 光扫成铜版画
    s.title = new THREE.Scene();
    s.title.background = new THREE.Color(0x060708);
    s.title.environment = STAGE.envRoom;
    s.title.environmentIntensity = 0.3;
    s.camTitle = STAGE.camera(30);
    s.tPlaneA = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    s.tPlaneB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    s.tPedal = M.pedal();
    s.tPedal.meshes.forEach((m) => { m.material = m.material.clone(); m.material.clippingPlanes = [s.tPlaneA]; });
    s.tHatch = M.pedal();
    const hm = STAGE.hatchMaterial({ ink: 0x2a2118, paper: 0xede3cc, spacing: 6, light: [0.6, 0.7, 0.5] });
    hm.clippingPlanes = [s.tPlaneB];
    s.tHatch.meshes.forEach((m) => { m.material = hm; m.castShadow = false; });
    s.tTurn = new THREE.Group(); s.tTurn.add(s.tPedal.group, s.tHatch.group); s.title.add(s.tTurn);
    s.tKey = new THREE.SpotLight(0xffffff, 120, 0, 0.4, 0.6, 1.2); s.tKey.position.set(3, 5, 6); s.tKey.target.position.set(0, -1.4, 0);
    s.title.add(s.tKey, s.tKey.target);
    const tr = new THREE.DirectionalLight(0xaabbd0, 2); tr.position.set(-4, 3, -3); s.title.add(tr);
    s.cTitle = STAGE.pipeline(s.title, s.camTitle, { bloom: [0.3, 0.4, 0.9], grain: 0.06, vig: 0.5 });
    return s;
  }

  /**
   * 取证 HUD：踏板力模块（层级描出 → 读数滚动落定）。
   * @param {CanvasRenderingContext2D} ctx @param {number} lt 模块出现后的时间 @param {number} k 曲线进度
   * @param {boolean} frozen 是否定格在峰值 @param {number} T 全片时间 @param {number|null} speed 车速
   */
  function forceHUD(ctx, lt, k, frozen, T, speed) {
    if (lt <= 0) return;
    const x = 1300, y = 720, w = 520, h = 140;
    const col = frozen ? RED : FG;
    ctx.save();
    ctx.strokeStyle = 'rgba(201,206,214,0.55)'; ctx.lineWidth = 1.5;
    const a0 = easeInOut(prog(lt, 0, 0.35));
    ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + w * a0, y + h); ctx.stroke();
    ctx.strokeStyle = 'rgba(201,206,214,0.14)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const p = easeInOut(prog(lt, 0.1 + i * 0.067, 0.45 + i * 0.067));
      ctx.beginPath(); ctx.moveTo(x, y + h * i / 4); ctx.lineTo(x + w * p, y + h * i / 4); ctx.stroke();
    }
    for (let i = 0; i <= 10; i++) {
      const p = prog(lt, 0.2 + i * 0.02, 0.3 + i * 0.02);
      ctx.strokeStyle = 'rgba(201,206,214,0.5)';
      ctx.beginPath(); ctx.moveTo(x + w * i / 10, y + h); ctx.lineTo(x + w * i / 10, y + h + 8 * p); ctx.stroke();
    }
    maskText(ctx, 'PEDAL FORCE', x, y - 22, pop(lt, 0.25, 'snap'), { size: 20, font: FONT_MONO, color: 'rgba(201,206,214,0.7)', spacing: 3 });
    maskText(ctx, '踏板力', x + 170, y - 22, pop(lt, 0.32, 'snap'), { size: 20, font: FONT_HEAD, color: 'rgba(201,206,214,0.7)' });
    if (speed != null) maskText(ctx, `${String(Math.round(speed)).padStart(3, ' ')} km/h`, x + w, y - 22, pop(lt, 0.4, 'snap'), { size: 22, font: FONT_MONO, color: 'rgba(201,206,214,0.85)', align: 'right' });
    ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = Math.floor(160 * k);
    let px = x, py = y + h;
    for (let i = 0; i <= n; i++) {
      const kk = i / 160;
      px = x + kk * w; py = y + h - (forceAt(kk) / 1800) * h + (frozen ? 0 : Math.sin(kk * 90 + T * 22) * 1.2);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
    if (n > 0) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); }
    let v = Math.round(frozen ? 1612 : forceAt(Math.min(k, 0.82)));
    const f = Math.floor(lt * 30);
    if (f < 5) v = Math.floor(rng(f * 77 + 3)() * 9999);
    const ra = pop(lt, 0.15, 'snap');
    maskText(ctx, String(v).padStart(4, ' '), x + w - 66, y + h + 118, ra, { size: 112, font: FONT_MONO, color: frozen ? RED : '#fff', align: 'right' });
    maskText(ctx, 'N', x + w, y + h + 118, ra, { size: 56, font: FONT_MONO, color: col, align: 'right' });
    if (frozen) maskText(ctx, '峰值 · 支架断裂', x, y + h + 112, pop(lt, 0, 'snap'), { size: 26, font: FONT_HEAD, color: RED });
    ctx.restore();
  }

  /** 锁定框：四角括号从 1.4 倍收缩吸附（快出缓入） */
  function brackets(ctx, cx, cy, w, h, k, color, label, below = false) {
    if (k <= 0) return;
    const s = lerp(1.4, 1.0, clamp(k, 0, 1.2));
    const hw = w * s / 2, hh = h * s / 2, l = 26;
    ctx.save();
    ctx.globalAlpha = clamp(k * 3);
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(cx + sx * hw, cy + sy * (hh - l)); ctx.lineTo(cx + sx * hw, cy + sy * hh); ctx.lineTo(cx + sx * (hw - l), cy + sy * hh); ctx.stroke();
    });
    ctx.restore();
    if (label) maskText(ctx, label, cx - hw, below ? cy + hh + 40 : cy - hh - 16, clamp((k - 0.6) * 2.5), { size: 26, font: FONT_HEAD, color });
  }

  /** 白边小窗：真实画面证据 */
  function pip(ctx, img, x, y, w, k) {
    if (k <= 0 || !img) return;
    const h = w * img.height / img.width;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + (1 - k) * 40);
    ctx.rotate((1 - k) * -0.05);
    ctx.globalAlpha = clamp(k * 2);
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#f4f4f2'; ctx.fillRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12);
    ctx.shadowColor = 'transparent';
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  /** 截图镜头的暗色台面：深灰底 + 右上方一盏柔光 @param {CanvasRenderingContext2D} ctx */
  function deskBG(ctx) {
    ctx.fillStyle = '#0b0c0e'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.62, H * 0.32, 0, W * 0.62, H * 0.32, W * 0.75);
    g.addColorStop(0, 'rgba(120,128,140,0.17)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  /** 截图镜头收尾：颗粒 + 暗角 @param {CanvasRenderingContext2D} ctx @param {number} T */
  function deskFinish(ctx, T) {
    grain(ctx, T, 0.07);
    vignette(ctx, 0.5);
  }

  /** 片名排版（章末用） */
  function titleType(ctx, lt, o = {}) {
    const x = o.x ?? 150;
    maskText(ctx, '一块踏板，', x, 430, pop(lt, 0, 'heavy'), { size: 136, font: FONT_HEAD, color: '#fff', spacing: 4 });
    maskText(ctx, '一百四十年', x, 590, pop(lt, 0.2, 'heavy'), { size: 136, font: FONT_HEAD, color: '#fff', spacing: 4 });
    const lp = easeInOut(prog(lt, 0.5, 1.1));
    ctx.fillStyle = RED; ctx.fillRect(x + 4, 640, 380 * lp, 5);
    maskText(ctx, '1886 — 2026', x + 4, 706, pop(lt, 0.7, 'snap'), { size: 44, font: FONT_MONO, color: RED, spacing: 2 });
    maskText(ctx, '刹车踏板发展简史', x + 4, 762, pop(lt, 0.85, 'snap'), { size: 30, font: FONT_BODY, color: 'rgba(201,206,214,0.8)', spacing: 6 });
  }

  SCENES[1] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, C = ch.cues;
      /** 口播锚点（章节内时间） @param {string} k */
      const cue = (k) => vo + C[k];
      // 报道段：热搜 → 三台断裂 → 尊界回应；动画段：揭示踏板 → 踩下 → 断裂 → 低头 → 片名
      const sEvid = cue('s3'), sWeibo = cue('s4'), sReveal = cue('s2') - 1.9, sPress = cue('press'), sSnap = cue('pa'),
        sLook = cue('s5'), sTitle = cue('origin'), end = ch.end - ch.start;
      const beat = TIMELINE.beat;
      S.dust.update(T);

      /** 脚坑常用布光 */
      const wellLight = () => {
        S.cWell.film.uniforms.uAberr.value = 0;
        S.key.intensity = 160; S.key.angle = 0.4; S.key.position.set(3.2, 3.4, 3.8); S.rim.intensity = 90;
      };

      /** A：光扫揭示，镜头从踏面微距沿踏板臂升到全貌 */
      const shotReveal = (t) => {
        S.cWell.film.uniforms.uAberr.value = 0;
        const lt = t - sReveal, dur = sPress - sReveal;
        const k = smooth(prog(lt, 0, dur + 0.3));
        const pos = add3(V([1.2, -2.7, 2.0], [5.2, 0.1, 6.6], k), hand(t));
        const look = V([0, -2.95, 0.62], [1.0, -1.25, -0.8], k);
        STAGE.aim(S.camWell, pos, look, lerp(26, 32, k));
        STAGE.focus(S.cWell, V([0, -2.95, 0.66], [0, -1.2, 0], k), lerp(0.006, 0.0025, k));
        const sw = easeInOut(prog(lt, 0.1, dur * 0.85));
        S.key.intensity = 160 * smooth(prog(lt, 0, 0.3));
        S.key.position.set(lerp(-6, 4.5, sw), 3.2, 3.6);
        S.key.angle = lerp(0.16, 0.4, sw);
        S.rim.intensity = 90 * smooth(prog(lt, 0.6, 2.2));
        S.pedal.setPress(0); S.pedal.setBreak(0, 0); S.redLight.intensity = 0;
        S.foot.update(S.pedal);
        STAGE.draw(S.cWell, T);
        forceHUD(ctx, lt - 1.4, 0, false, T, 100);
      };

      /** B：三家媒体报道平铺堆叠在右侧，左侧日期 + 标题 + 媒体要点 */
      const shotNews = (t) => {
        const lt = t;
        deskBG(ctx);
        const drift = 1 - Math.pow(1 - prog(lt, 0, sEvid + 0.6), 2);
        const z = 1 + 0.04 * drift;
        ctx.save(); ctx.translate(1350, 600); ctx.scale(z, z); ctx.translate(-1350 - 30 * drift, -600);
        [['cnr_tracking', 1110, 600, -0.05], ['nbd_three_cars', 1350, 570, 0.028], ['bjnews_reply', 1585, 620, -0.018]].forEach(([k, x, y, r], i) => {
          const img = IMG[k];
          card(ctx, img, x, y, 640, r, pop(lt, i * beat * 0.5 - 0.15, 'card'), { sh: img.width * 0.8, from: [300, 70], rot0: 0.12 });
        });
        ctx.restore();
        maskText(ctx, '2026.10.08', 110, 250, pop(lt, 0.1, 'card'), { size: 104, font: FONT_MONO, color: '#fff', spacing: 2 });
        maskText(ctx, '懂车帝发布尊界 V800 制动测试视频', 114, 318, pop(lt, vo + 1.2, 'card'), { size: 38, font: FONT_HEAD, color: FG });
        ctx.fillStyle = RED; ctx.fillRect(114, 352, 72 * easeInOut(prog(lt, vo + 1.4, vo + 1.8)), 5);
        [['央广网', '事件追踪'], ['每日经济新闻', '三辆车断口一致'], ['新京报', '尊界回应：免费升级']].forEach(([m, d], i) => {
          const k = pop(lt, vo + 2.0 + i * beat * 0.75, 'snap');
          maskText(ctx, m, 114, 452 + i * 64, k, { size: 30, font: FONT_HEAD, color: '#fff' });
          maskText(ctx, d, 330, 452 + i * 64, k, { size: 28, font: FONT_BODY, color: FG });
        });
        sourceTag(ctx, '来源：央广网 · 每日经济新闻 · 新京报 · 2026.10.08');
        deskFinish(ctx, T);
      };

      /** C：踩下踏板，力曲线爬升，左上角真实测试画面 */
      const shotPress = (t) => {
        wellLight();
        const lt = t - sPress, k = prog(t, sPress, sSnap);
        const fk = lerp(0.04, 0.8, easeOut(k));
        S.pedal.setPress(0.04 + 0.2 * forceAt(fk) / 1612);
        S.pedal.setBreak(0, 0); S.redLight.intensity = 0;
        const e = tail(k);
        STAGE.aim(S.camWell, add3(V([5.0, -0.2, 6.2], [3.2, 1.35, 3.6], e), hand(t)), V([0.6, -1.3, -0.4], [0.35, 0.4, -0.45], e), lerp(32, 30, e));
        STAGE.focus(S.cWell, V([0, -1.4, 0.2], [0, 0.55, -0.2], e), 0.003);
        S.foot.update(S.pedal);
        STAGE.draw(S.cWell, T);
        forceHUD(ctx, 10, fk, false, T, lerp(100, 8, easeIn(k)));
        pip(ctx, IMG.dcd_frame_wscn_1, 90, 90, 560, pop(lt, 0.1, 'card'));
        if (lt > 0.1) sourceTag(ctx, '测试画面：懂车帝实测（华尔街见闻转载）· 2026.10.08');
        const bp = STAGE.projectLocal(S.pedal.group, [0.34, 0.6, -0.2], S.camWell);
        brackets(ctx, bp.x, bp.y, 330, 150, pop(t, sSnap - 1.2, 'snap'), FG, '支架底座');
      };

      /** D：断裂高潮（硬切 + 白闪） */
      const shotSnap = (t) => {
        wellLight();
        const lt = t - sSnap, tau = lt * 0.35;
        const kb = spring(tau, 9, 0.5);
        S.pedal.setPress(0.24);
        S.pedal.setBreak(kb, tau);
        S.redLight.intensity = 6 * Math.exp(-lt * 2.2);
        S.key.intensity = 110; S.key.position.set(1.5, 4.2, 4.2); S.rim.intensity = 22;
        const sh = 0.09 * Math.exp(-8 * lt);
        const az = lerp(0.72, 1.0, easeOut(prog(lt, 0, sLook - sSnap)));
        const pos = STAGE.orbit([0, 0.2, 0], 4.6, az, 0.2);
        STAGE.aim(S.camWell, add3(pos, [Math.sin(t * 71) * sh, Math.cos(t * 53) * sh, 0]), [0.25, -0.05, -0.15], 32);
        STAGE.focus(S.cWell, [0, 0.55, -0.2], 0.003);
        S.cWell.film.uniforms.uAberr.value = 0.004 * Math.exp(-7 * lt);
        S.foot.update(S.pedal);
        STAGE.draw(S.cWell, T);
        forceHUD(ctx, lt + 10, 1, true, T, 0);
        const bp = STAGE.projectLocal(S.pedal.group, [0.34, 0.6, -0.2], S.camWell);
        brackets(ctx, bp.x, bp.y, 330, 150, 1, RED, '支架底座 · 断裂', true);
        const f = Math.floor(lt * 30);
        if (f <= 1) { ctx.fillStyle = `rgba(255,255,255,${f === 0 ? 1 : 0.3})`; ctx.fillRect(0, 0, W, H); }
      };

      /** E：四张实测画面逐张叠上来，右侧逐行列出断裂时机 */
      const shotEvid = (t) => {
        const lt = t - sEvid, seg = (sWeibo - sEvid) / 4;
        deskBG(ctx);
        const z = 1 + 0.035 * prog(lt, 0, sWeibo - sEvid + 0.5);
        ctx.save(); ctx.translate(700, 540); ctx.scale(z, z); ctx.translate(-700, -540);
        const keys = ['dcd_frame_wscn_4', 'dcd_frame_wscn_2', 'dcd_frame_qdxin_2', 'dcd_frame_wscn_3'];
        const rots = [-0.022, 0.018, -0.012, 0.006], offs = [[-24, -16], [20, 10], [-12, 18], [0, 0]];
        keys.forEach((k, i) => card(ctx, IMG[k], 700 + offs[i][0], 530 + offs[i][1], 1080, rots[i],
          pop(t, i === 0 ? sEvid - 0.8 : sEvid + i * seg - 0.3, 'card'), { from: [560, 30], rot0: 0.1 }));
        ctx.restore();
        const rx = 1380;
        [['第 1 台', '第 3 脚'], ['第 2 台', '第 4 脚'], ['第 3 台', '第 2 脚']].forEach(([c1, c2], i) => {
          const k = pop(lt, 0.5 + i * beat, 'snap');
          maskText(ctx, c1, rx, 350 + i * 96, k, { size: 44, font: FONT_HEAD, color: '#fff' });
          maskText(ctx, c2, rx + 190, 350 + i * 96, k, { size: 44, font: FONT_MONO, color: RED });
          if (k > 0.5) { ctx.fillStyle = RED; ctx.fillRect(rx + 380, 320 + i * 96, 28 * clamp((k - 0.5) * 2), 28); }
        });
        maskText(ctx, '支架全部断裂', rx, 660, pop(t, cue('bracket'), 'card'), { size: 40, font: FONT_HEAD, color: FG });
        maskText(ctx, '断口几乎一模一样', rx, 712, pop(t, cue('same'), 'card'), { size: 40, font: FONT_HEAD, color: RED });
        const i = clamp(Math.floor((lt + 0.3) / seg), 0, 3);
        sourceTag(ctx, (i === 2 ? '来源：懂车帝实测（信网转载）' : '来源：懂车帝实测（华尔街见闻转载）') + ' · 2026.10.08');
        deskFinish(ctx, T);
      };

      /** F：尊界微博原帖平铺在右侧缓慢上卷，关键句划红线，左侧同步写出要点 */
      const shotWeibo = (t) => {
        const lt = t - sWeibo, q1 = cue('q1'), q2 = cue('q2');
        deskBG(ctx);
        const img = IMG.zunjie_weibo_original, w = 860, s = w / img.width, h = img.height * s;
        const x0 = W - 150 - w;
        const y0 = lerp(70, H - h - 70, easeInOut(prog(t, q1 + 1.0, q2 - 0.1)));
        card(ctx, img, x0 + w / 2, y0 + h / 2, w, 0, pop(lt, -0.4, 'card'), { from: [0, 160], rot0: 0 });
        const starts = [q1, q1 + 0.55, q2, q2 + 0.55];
        [[437, 790, 1050], [34, 846, 802], [835, 1000, 1050], [34, 1056, 942]].forEach(([u0, y, u1], j) => {
          const p = easeInOut(prog(t, starts[j], starts[j] + 0.55));
          if (p > 0) { ctx.fillStyle = RED; ctx.fillRect(x0 + u0 * s, y0 + (y + 20) * s, (u1 - u0) * s * p, 5); }
        });
        const lx = 120;
        maskText(ctx, '尊界汽车', lx, 300, pop(lt, 0.2, 'card'), { size: 72, font: FONT_HEAD, color: '#fff' });
        maskText(ctx, '官方情况说明', lx, 370, pop(lt, 0.35, 'card'), { size: 40, font: FONT_HEAD, color: FG });
        maskText(ctx, '2026.10.08  21:08', lx + 2, 426, pop(lt, 0.5, 'card'), { size: 32, font: FONT_MONO, color: FG });
        ctx.fillStyle = RED; ctx.fillRect(lx + 2, 460, 60 * easeInOut(prog(lt, 0.6, 1)), 4);
        maskText(ctx, '用户实际使用中', lx, 590, pop(t, q1, 'card'), { size: 32, font: FONT_BODY, color: FG });
        maskText(ctx, '未发生支架断裂故障', lx, 646, pop(t, q1 + 0.12, 'card'), { size: 44, font: FONT_HEAD, color: '#fff' });
        maskText(ctx, '将优化该部件设计', lx, 750, pop(t, q2, 'card'), { size: 32, font: FONT_BODY, color: FG });
        maskText(ctx, '已交付车辆免费升级', lx, 806, pop(t, q2 + 0.12, 'card'), { size: 44, font: FONT_HEAD, color: RED });
        sourceTag(ctx, '来源：尊界汽车官方微博（封面新闻刊发于新浪财经）· 2026.10.08');
        deskFinish(ctx, T);
      };

      /** G：低头看向脚下 */
      const shotLook = (t) => {
        wellLight();
        const k = prog(t, sLook, sTitle), e = tail(k);
        S.pedal.setPress(0); S.pedal.setBreak(0, 0); S.redLight.intensity = 0;
        S.key.position.set(0.5, 4, 2.5);
        STAGE.aim(S.camWell, add3([0.4, 2.3, 4.8], hand(t, 1.5)), V([0, 1.9, -4], [0, -2.1, 0.3], e), lerp(46, 36, e));
        STAGE.focus(S.cWell, [0, -2.9, 0.6], lerp(0.001, 0.004, e));
        S.foot.update(S.pedal);
        STAGE.draw(S.cWell, T);
      };

      /** H：片名转台，光扫成铜版画 */
      const shotTitle = (t) => {
        const lt = t - sTitle;
        const sweep = lerp(2.4, -2.4, easeInOut(prog(lt, 1.2, 5.2)));
        S.tPlaneA.constant = -sweep; S.tPlaneB.constant = sweep;
        S.tTurn.rotation.y = lerp(-0.9, 0.5, tail(prog(lt, 0, end - sTitle)));
        S.tPedal.setPress(0); S.tHatch.setPress(0);
        STAGE.aim(S.camTitle, add3([-2.3, -0.6, 9.2], hand(t, 0.6)), [-2.1, -1.25, 0], 30);
        STAGE.draw(S.cTitle, T);
        titleType(ctx, t - (end - 4.6));
      };

      sequence(ctx, t, [
        { t0: 0, f: shotNews },
        { t0: sEvid, f: shotEvid, tr: 'whip' },
        { t0: sWeibo, f: shotWeibo, tr: 'whip' },
        { t0: sReveal, f: shotReveal, tr: 'dip' },
        { t0: sPress, f: shotPress, tr: 'zoom' },
        { t0: sSnap, f: shotSnap },
        { t0: sLook, f: shotLook, tr: 'dip' },
        { t0: sTitle, f: shotTitle, tr: 'wipe' },
      ]);
    },
    /** 封面帧（cover.js 调用）：支架正在断开的一瞬 */
    cover(ctx, T) {
      S.dust.update(3);
      S.pedal.setPress(0.24);
      S.pedal.setBreak(spring(0.16, 9, 0.5), 0.16);
      S.redLight.intensity = 5;
      S.key.intensity = 170; S.key.angle = 0.4; S.key.position.set(3.2, 3.6, 3.4); S.rim.intensity = 110;
      S.cWell.film.uniforms.uAberr.value = 0.0012;
      STAGE.aim(S.camWell, [4.4, 0.6, 6.6], [-1.55, -1.35, -0.9], 32);
      STAGE.focus(S.cWell, [0, 0.55, -0.2], 0.003);
      S.foot.update(S.pedal);
      STAGE.draw(S.cWell, T);
      return { RED };
    },
  };
})();
