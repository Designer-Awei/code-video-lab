/**
 * 第 8 章 · 约定（已确认版）
 * 金色放射线底。五种形态为独立机械插画；约定镜头保留彩色踏板和分层文字；
 * 时间线左侧换字、右侧轮播专用插画；结尾用大字打字和回删。
 */
(function () {
  const { W, H, clamp, lerp, prog, smooth, pop, maskText, text, card, sequence, grain, anchor, FONT_MONO, FONT_HEAD } = L;
  const DARK = '#1F1A14', RED = '#B0281E', GOLD = '#B8893A';
  const hand = (t) => [Math.sin(t * 1.1) * 0.008, Math.sin(t * 1.7 + 1) * 0.006, 0];
  const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const FORM_WORDS = ['一根杠杆', '一块木头', '一块钢板', '一块复合', '一个传感器'];
  const FORM_LABEL = ['一根杠杆', '一块木头', '一块钢板', '复合材料', '一个传感器'];
  const REEL_COPY = [
    ['1886', '杠杆', '用手去拉一根杆'],
    ['1908', '三踏板', '脚下有了三块踏板'],
    ['1921', '液压', '推一管液体，不再拉钢丝'],
    ['1953', '盘式', '卡钳夹住一张圆盘'],
    ['1978', 'ABS', '一秒钟松开、踩下很多次'],
    ['2001', '线控', '踏板变成了传感器'],
    ['2026', 'EMB', '传出去的只是电信号'],
  ];
  const LINE1 = '我是Awei';
  const LINE2 = '我们下期见';
  const TYPE_SIZE = 390;
  const OUTRO_FONT = '"OutroSong", "Noto Serif CJK SC", "SimSun", serif';
  let S = null;

  /**
   * 给踏板上前几章用的那套颜色。不改共享材质。
   * @param {ReturnType<M.pedal>} pedal
   * @param {number} arm 臂的颜色
   */
  function tintPedal(pedal, arm) {
    pedal.meshes.forEach((m) => {
      const hex = m.material.color?.getHex?.() ?? 0;
      if (hex === 0x0c0c0d) { m.visible = false; return; }
      let col = null;
      if (hex === 0x0e0f10) col = 0x8c4a32;
      else if (hex === 0x17181b || hex === 0x24272b) col = m === pedal.pad ? 0xc4a574 : arm;
      else if (hex === 0x8b929b) col = 0xe6ebf0;
      else if (hex === 0x15161a) col = 0x1f6f86;
      else if (hex === 0xdfe3e8) col = 0xc9a25a;
      if (col != null) m.material = STAGE.toon(col);
    });
    pedal.group.traverse((o) => { if (o.isInstancedMesh) o.material = STAGE.toon(0xc9a25a); });
  }

  function build() {
    const s = {};
    s.scene = new THREE.Scene();
    s.scene.background = STAGE.decoTexture();
    s.cam = STAGE.camera(32);
    s.comp = STAGE.pipeline(s.scene, s.cam, { flat: true, ink: { color: 0x1f1a14, width: 1.15 }, grain: 0.04, vig: 0.1 });
    s.scene.add(new THREE.AmbientLight(0xffffff, 0.92));
    const key = new THREE.DirectionalLight(0xffffff, 2.05);
    key.position.set(4, 6, 5);
    s.scene.add(key);
    S = s;

    s.forms = [];
    s.reel = [];

    s.pedal = M.pedal();
    tintPedal(s.pedal, 0x5c6e80);
    s.scene.add(s.pedal.group);
    s.pedal.group.visible = false;
    return s;
  }

  /** @param {THREE.Object3D[]} list */
  function show(list) {
    S.forms.forEach((g) => { g.visible = false; });
    S.reel.forEach((g) => { g.visible = false; });
    S.pedal.group.visible = false;
    list.forEach((g) => { g.visible = true; });
  }

  SCENES[8] = {
    init() { S = build(); },
    render(ctx, t, ch, T) {
      const vo = ch.vo_start - ch.start, full = ch.text;
      const a = (s) => vo + anchor(full, s, ch.vo_duration);
      const sSys = a('它背后'), sMust = a('它必须在那里'), sStep = a('用尽全力'), sDebate = a('这次测试'), sLook = a('下次坐进');
      const sBye = a('我是阿伟'), sNext = a('我们下期见');
      const end = ch.end - ch.start;
      const formAt = FORM_WORDS.map((w) => a(w));

      /** A: projector gate with five genuinely different material/mechanism plates. */
      const shotForms = (t) => {
        show([]); STAGE.paintDeco(ctx, W, H);
        const ids = ['lever', 'wood', 'steel', 'composite', 'sensor'];
        const details = ['支点、手柄与拉杆', '木质刹车块 · 皮质摩擦面', '冲压成形的钢板踏板臂', '纤维铺层 · 模压加强筋', '转角检测 · 电信号输出'];
        let i = 0; while (i < 4 && t >= formAt[i+1]) i++;
        const advance = i > 0 ? L.easeInOut(prog(t, formAt[i], formAt[i] + .48)) : 1;
        const frame = Math.floor(t * 18);
        text(ctx, '一百四十年', 110, 218, {size:76, color:DARK});
        text(ctx, '从材料，到信号', 115, 287, {size:32, color:GOLD});
        text(ctx, String(i+1).padStart(2,'0'), 110, 477, {size:110, color:RED});
        text(ctx, FORM_LABEL[i], 112, 568, {size:64, color:DARK});
        text(ctx, details[i], 116, 642, {size:27, color:DARK});
        for(let j=0;j<5;j++) {
          ctx.fillStyle=j===i?RED:'rgba(48,41,31,.20)';ctx.fillRect(118+j*77,725,56,4);
        }
        /** Continuous four-perforation strip: frames and sprockets share one displacement. */
        const pitch=756, travel=(i-1+advance)*pitch;
        ctx.save();ctx.beginPath();ctx.rect(705,0,1135,H);ctx.clip();
        ctx.fillStyle='#3d2b20';ctx.fillRect(705,0,1135,H);
        ctx.fillStyle='#6d4930';ctx.fillRect(709,0,5,H);ctx.fillRect(1830,0,5,H);
        for(let n=-1;n<=5;n++) {
          const cy=H/2+n*pitch-travel, top=cy-350;
          if(top>H||top+700<0)continue;
          ctx.fillStyle='#e6d4aa';ctx.fillRect(790,top,966,700);
          ctx.strokeStyle='#ab7e47';ctx.lineWidth=2;ctx.strokeRect(790,top,966,700);
          ctx.save();ctx.beginPath();ctx.rect(798,top+7,950,686);ctx.clip();
          if(n>=0&&n<5){
            CH8_ART.draw(ctx,ids[n],807,top+12,930,611,t);
            text(ctx,FORM_LABEL[n],1272,top+665,{size:35,color:DARK,align:'center'});
          }
          ctx.fillStyle=`rgba(53,30,11,${.018+.025*L.hash(frame+81)})`;
          ctx.fillRect(790,top,966,700);ctx.restore();
          if(n>=0&&n<5)text(ctx,String(n+1).padStart(2,'0'),1737,top+730,{size:20,font:FONT_MONO,color:'#c8a66a',align:'right'});
        }
        for(const x of [731,1780])for(let j=-5;j<30;j++) {
          const y=19+j*(pitch/4)-travel;
          ctx.fillStyle='#e5d5b1';ctx.beginPath();ctx.roundRect(x,y,43,61,6);ctx.fill();
          ctx.strokeStyle='#9d7a4e';ctx.lineWidth=2;ctx.stroke();
        }
        /** Fine emulsion scratches remain tied to the strip. */
        ctx.strokeStyle='rgba(220,182,117,.2)';ctx.lineWidth=1;
        for(const x of [719,781,1766,1822]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
        ctx.restore();grain(ctx,T,.055);
      };

      /** B：彩色踏板占右半，左边文字分成三档大小 */
      const shotMust = (t) => {
        show([S.pedal.group]);
        const d = t - sStep;
        const kick = d > 0 && d < 1.15 ? Math.sin(Math.PI * clamp(d / 1.05)) : 0;
        S.pedal.setPress(0.04 + kick * 0.34);
        S.pedal.setBreak(0, 0);
        S.pedal.group.position.set(1.85, 0.42, 0);
        S.pedal.group.rotation.set(0.06, 0.58, 0);
        S.pedal.group.scale.setScalar(0.7);
        STAGE.aim(S.cam, add3([3.5, 1.7, 6.8], hand(t)), [1.55, -0.55, 0.05], 30);
        STAGE.draw(S.comp, T);
        maskText(ctx, '约定', 110, 188, pop(t, sSys, 'snap'), { size: 26, font: FONT_MONO, color: GOLD });
        maskText(ctx, '系统可以越来越聪明', 110, 280, pop(t, sSys + 0.1, 'card'), { size: 32, font: FONT_HEAD, color: 'rgba(31,26,20,0.72)' });
        maskText(ctx, '和人的约定', 110, 400, pop(t, a('约定从来'), 'card'), { size: 64, font: FONT_HEAD, color: DARK });
        maskText(ctx, '没有变', 110, 490, pop(t, a('约定从来') + 0.15, 'card'), { size: 64, font: FONT_HEAD, color: DARK });
        maskText(ctx, '在最紧急的那一刻', 110, 680, pop(t, a('在最紧急'), 'card'), { size: 36, font: FONT_HEAD, color: DARK });
        maskText(ctx, '你用尽全力踩下去', 110, 748, pop(t, sStep, 'card'), { size: 36, font: FONT_HEAD, color: RED });
        maskText(ctx, '它必须在那里。', 110, 900, pop(t, sMust, 'heavy'), { size: 78, font: FONT_HEAD, color: DARK });
      };

      /** C：两张报道，不写复测和责任那两句 */
      const shotDebate = (t) => {
        show([]);
        STAGE.paintDeco(ctx, W, H);
        const lt = t - sDebate;
        card(ctx, IMG.ithome_dongchedi_reply, 560, 500, 820, -0.03, pop(lt, 0.05, 'card'), { from: [-40, 80], rot0: -0.04 });
        card(ctx, IMG.zunjie_weibo_original, 1420, 540, 620, 0.02, pop(lt, 0.45, 'card'), { from: [50, 70], rot0: 0.04 });
        maskText(ctx, '来源：IT之家 · 尊界汽车官方微博 · 2026.10.08–09', 116, 1020, pop(lt, 0.8, 'snap'), { size: 22, font: FONT_MONO, color: 'rgba(31,26,20,0.55)' });
        grain(ctx, T, 0.06);
      };

      /** D: retrospective montage. Dates are recap captions, not extra narration. */
      const reelStart = a('但它提醒');
      const reelEnd = sBye - .42;
      const slot = (reelEnd - reelStart) / REEL_COPY.length;
      const shotLook = (t) => {
        show([]); STAGE.paintDeco(ctx,W,H);
        const ids=['lever','three','hydraulic','disc','abs','wire','emb'];
        const u=clamp((t-reelStart)/slot,0,REEL_COPY.length-.00001);
        const i=Math.floor(u), within=(u-i)*slot;
        const incoming=i>0?smooth(prog(within,0,.23)):1;
        const alpha=1-smooth(prog(t,reelEnd,sBye-.03));
        ctx.save();ctx.globalAlpha=alpha;
        text(ctx,'一百四十年的演进',110,171,{size:36,color:GOLD});
        /** Clip the text and the art separately so neither can invade the other. */
        const drawCopy=(n,dy,opacity)=>{
          const [year,name,line]=REEL_COPY[n];
          ctx.save();ctx.beginPath();ctx.rect(90,230,710,526);ctx.clip();ctx.translate(0,dy);ctx.globalAlpha*=opacity;
          text(ctx,year,110,394,{size:126,color:DARK});
          text(ctx,name,112,522,{size:83,color:RED});
          text(ctx,line,116,610,{size:32,color:DARK});ctx.restore();
        };
        if(incoming<1)drawCopy(i-1,-incoming*480,1-incoming);
        drawCopy(i,(1-incoming)*480,incoming);
        ctx.save();ctx.beginPath();ctx.rect(817,120,1050,790);ctx.clip();
        if(incoming<1)CH8_ART.draw(ctx,ids[i-1],827,122-incoming*790,1040,790,t);
        CH8_ART.draw(ctx,ids[i],827,122+(1-incoming)*790,1040,790,t);
        ctx.restore();
        for(let j=0;j<7;j++){
          ctx.fillStyle=j===i?RED:'rgba(48,41,31,.20)';ctx.fillRect(116+j*84,727,62,5);
        }
        const footer=t>=sLook?'不妨低头看它一眼':'小小的零件，沉重的责任';
        text(ctx,footer,115,969,{size:47,color:DARK});
        ctx.restore();grain(ctx,T,.045);
      };

      /** E: fixed text origin gives a real advancing/deleting cursor, without re-centring. */
      const shotBye = (t) => {
        show([]); STAGE.paintDeco(ctx,W,H);
        const stepIn=.09, stepOut=.035;
        const typeEnd=sBye+LINE1.length*stepIn;
        const delStart=typeEnd+.18, delEnd=delStart+LINE1.length*stepOut;
        const type2=Math.max(sNext,delEnd+.09);
        let shown='', active=LINE1, moving=false;
        if(t<delStart){shown=LINE1.slice(0,Math.floor(clamp((t-sBye)/stepIn,0,LINE1.length)));moving=t<typeEnd;}
        else if(t<type2){shown=LINE1.slice(0,LINE1.length-Math.floor(clamp((t-delStart)/stepOut,0,LINE1.length)));moving=t<delEnd;}
        else {active=LINE2;shown=LINE2.slice(0,Math.floor(clamp((t-type2)/stepIn,0,LINE2.length)));moving=shown.length<LINE2.length;}
        ctx.save();ctx.font=`${TYPE_SIZE}px ${OUTRO_FONT}`;
        const metrics=ctx.measureText(active), maxWidth=1740;
        const scaleX=Math.min(1,maxWidth/metrics.width);
        const x=(W-metrics.width*scaleX-30)/2;
        const asc=metrics.actualBoundingBoxAscent,desc=metrics.actualBoundingBoxDescent;
        const baseline=(H+asc-desc)/2;
        ctx.translate(x,baseline);ctx.scale(scaleX,1);
        /** Warm letterpress faces with a small stamped extrusion and per-keystroke spring. */
        let pen=0;
        for(let j=0;j<shown.length;j++) {
          const char=shown[j], born=(active===LINE2?type2:sBye)+(j+1)*stepIn;
          const k=L.spring(Math.max(0,t-born),24,.7);
          const lift=-17*(1-k), tilt=-.035*(1-k);
          ctx.save();ctx.translate(pen,lift);ctx.rotate(tilt);
          ctx.font=`${TYPE_SIZE}px ${OUTRO_FONT}`;
          ctx.lineJoin='round';ctx.lineWidth=3;
          ctx.strokeStyle='#f5e3b2';ctx.strokeText(char,0,0);
          ctx.fillStyle='#753c27';
          for(let depth=7;depth>0;depth--)ctx.fillText(char,depth*.6,depth);
          ctx.fillStyle= j>=2&&active===LINE1?'#a33827':'#b85632';
          ctx.fillText(char,0,0);
          ctx.restore();pen+=ctx.measureText(char).width;
        }
        if(moving||Math.floor((t-sBye)*3)%2===0){
          ctx.fillStyle='#a33827';ctx.fillRect(pen+16,-asc,10,asc+desc);
          ctx.fillStyle='#e7b15c';ctx.fillRect(pen+18,-asc+2,3,asc+desc-4);
        }
        ctx.restore();
        const black=smooth(prog(t,type2+LINE2.length*stepIn+1.1,end-.45));
        ctx.fillStyle=`rgba(0,0,0,${black})`;ctx.fillRect(0,0,W,H);
      };

      sequence(ctx, t, [
        { t0: 0, f: shotForms },
        { t0: sSys, f: shotMust, tr: 'wipe' },
        { t0: sDebate, f: shotDebate, tr: 'wipe' },
        { t0: reelStart, f: shotLook, tr: 'wipe', dur: 0.28 },
        { t0: sBye - 0.02, f: shotBye },
      ]);
    },
  };
})();
