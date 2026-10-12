/**
 * 第 3–8 章的程序化模型：蓝图零件、制动器爆炸图、T 型车三踏板、液压底盘、真空助力器、通风盘、蘑菇按钮。
 * 坐标：Y 向上；底盘类模型 X 为车头方向。
 */
(function () {
  const ME = {};
  const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;

  /**
   * 蓝图化：半透明蓝面 + 白色棱线（棱线作子物体，跟随网格）。
   * @param {THREE.Mesh} mesh @param {{fill?:THREE.Material, color?:number, width?:number, angle?:number}} [o]
   */
  ME.blueprint = function (mesh, o = {}) {
    mesh.material = o.fill ?? ME.bpFill();
    mesh.userData.edge = STAGE.edges(mesh, { color: o.color ?? 0xe8f0ff, width: o.width ?? 1.6, angle: o.angle ?? 30 });
    return mesh;
  };
  /** 共用蓝图面材质 */
  ME.bpFill = () => (ME._bp ??= STAGE.blueprintFill(0x3a6fb0, 0.28));
  /** 设置一组蓝图网格的棱线颜色 @param {THREE.Object3D} root @param {number} color */
  ME.tint = function (root, color) {
    root.traverse((o) => { if (o.material?.isLineMaterial) o.material.color.setHex(color); });
  };

  /**
   * 3D 箭头（沿 +Y），可设长度。
   * @param {THREE.Material} mat @param {number} [r] 杆半径
   */
  ME.arrow = function (mat, r = 0.03) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 12), mat);
    const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, r * 6, 16), mat);
    g.add(shaft, head);
    g.userData.set = (len) => {
      const L = Math.max(0.001, len - r * 6);
      shaft.scale.y = L; shaft.position.y = L / 2; head.position.y = L + r * 3;
      g.visible = len > 0.01;
    };
    g.userData.set(1);
    return g;
  };

  /** 圆环带（制动带、制动蹄）挤出：内外半径、起止角、厚度 */
  function arcBand(r0, r1, a0, a1, depth, seg = 48) {
    const s = new THREE.Shape();
    for (let i = 0; i <= seg; i++) { const a = lerp(a0, a1, i / seg); const p = [Math.cos(a) * r1, Math.sin(a) * r1]; i ? s.lineTo(...p) : s.moveTo(...p); }
    for (let i = seg; i >= 0; i--) { const a = lerp(a0, a1, i / seg); s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: seg });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  ME.arcBand = arcBand;

  const WOOD = 0xc4a574, IRON = 0x3a3128, BRASS = 0xc9a25a, RUBBER = 0x2a241c, LEATHER = 0x8c4a32;
  /**
   * 卡通实体网格，记下原色，方便镜头里高亮。
   * @param {THREE.BufferGeometry} geo @param {number} color @param {THREE.Object3D} parent
   */
  function solid(geo, color, parent) {
    const m = new THREE.Mesh(geo, STAGE.toon(color));
    m.userData.base = color;
    parent.add(m);
    return m;
  }
  /** 把网格（或组内网格）涂成高亮色或恢复原色 @param {THREE.Object3D} root @param {boolean} on @param {number} [hot] */
  ME.paint = function (root, on, hot = 0xb0281e) {
    root.traverse((o) => { if (o.isMesh && o.material?.color) o.material.color.setHex(on ? hot : (o.userData.base ?? hot)); });
  };
  /**
   * 扁钢：两端相接，用来做踏板臂和踏面，避免两段模型中间断开。
   * @param {number[]} a @param {number[]} b @param {number} w 宽度 @param {number} thick 厚度 @param {number} color @param {THREE.Object3D} parent
   */
  function strap(a, b, w, thick, color, parent) {
    const va = v3(a), vb = v3(b);
    const len = Math.max(0.001, va.distanceTo(vb));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, thick), STAGE.toon(color));
    m.userData.base = color;
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    const dir = vb.clone().sub(va);
    if (dir.lengthSq() > 1e-8) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    parent.add(m);
    return m;
  }

  /** 辐条：从内半径拉到外半径 @param {THREE.Object3D} parent @param {number} n @param {number} r0 @param {number} r1 @param {number} z @param {number} color @param {number} [thick] */
  function spokes(parent, n, r0, r1, z, color, thick = 0.012) {
    const len = r1 - r0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = solid(new THREE.CylinderGeometry(thick, thick, len, 6), color, parent);
      s.position.set(Math.cos(a) * (r0 + r1) / 2, Math.sin(a) * (r0 + r1) / 2, z);
      s.rotation.z = a - Math.PI / 2;
    }
  }

  /**
   * 1896 维洛车后轮 + 脚踏制动带。轮轴沿 Z。轮胎、轮辋、辐条、轮毂、鼓、制动带、脚踏板。
   * @returns {{group:THREE.Group, wheel:THREE.Group, band:THREE.Mesh, pedal:THREE.Group, setPress:(k:number)=>void, spin:(a:number)=>void}}
   */
  ME.velo = function () {
    const g = new THREE.Group(), wheel = new THREE.Group();
    g.add(wheel);
    solid(new THREE.TorusGeometry(0.78, 0.09, 16, 80), RUBBER, wheel);
    solid(new THREE.TorusGeometry(0.68, 0.028, 10, 72), BRASS, wheel);
    solid(new THREE.TorusGeometry(0.62, 0.016, 8, 64), IRON, wheel);
    spokes(wheel, 16, 0.12, 0.6, 0, BRASS, 0.011);
    const hub = solid(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 24), BRASS, wheel); hub.rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const b = solid(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), IRON, wheel);
      b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.055, Math.sin(a) * 0.055, 0.09);
    }
    const drum = solid(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 40), IRON, wheel); drum.rotation.x = Math.PI / 2; drum.position.z = 0.16;
    const axle = solid(new THREE.CylinderGeometry(0.028, 0.028, 0.7, 12), IRON, g); axle.rotation.x = Math.PI / 2;
    const band = solid(arcBand(0.21, 0.245, -1.15, Math.PI * 1.5, 0.07), LEATHER, g);
    band.position.z = 0.16;
    const pedal = new THREE.Group(); pedal.position.set(0.62, -0.28, 0.16); g.add(pedal);
    const arm = solid(new THREE.BoxGeometry(0.045, 0.48, 0.04), IRON, pedal); arm.position.set(0.14, 0.2, 0); arm.rotation.z = -0.55;
    const pad = solid(new THREE.BoxGeometry(0.22, 0.045, 0.16), WOOD, pedal); pad.position.set(0.3, 0.4, 0); pad.rotation.z = -0.15;
    const pivot = solid(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16), BRASS, pedal); pivot.rotation.x = Math.PI / 2;
    const rod = solid(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), IRON, g);
    const bandEnd = v3([Math.cos(-1.15) * 0.23, Math.sin(-1.15) * 0.23, 0.16]);
    return {
      group: g, wheel, band, pedal, rod,
      setPress(k) {
        pedal.rotation.z = -0.35 * k;
        band.scale.setScalar(1 - 0.05 * k);
        const tip = v3([-0.04, 0.02, 0]).applyAxisAngle(new THREE.Vector3(0, 0, 1), -0.35 * k).add(pedal.position);
        M.stretch(rod, bandEnd.clone().multiplyScalar(1 - 0.05 * k).setZ(0.16), tip);
      },
      spin(a) { wheel.rotation.z = a; },
    };
  };

  /**
   * 盘式制动（蓝图爆炸图）：制动盘 + 卡钳 + 两片摩擦片。盘面法线沿 Z。
   * @returns {{group:THREE.Group, parts:THREE.Mesh[], explode:(k:number[])=>void, disc:THREE.Mesh}}
   */
  ME.discBrake = function () {
    const g = new THREE.Group();
    const disc = solid(new THREE.CylinderGeometry(0.62, 0.62, 0.018, 72), IRON, g); disc.rotation.x = Math.PI / 2; disc.position.z = 0.03;
    const disc2 = solid(new THREE.CylinderGeometry(0.62, 0.62, 0.018, 72), IRON, g); disc2.rotation.x = Math.PI / 2; disc2.position.z = -0.03;
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * Math.PI * 2;
      const v = solid(new THREE.BoxGeometry(0.18, 0.028, 0.05), BRASS, g);
      v.position.set(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0); v.rotation.z = a + 0.25;
      const slot = solid(new THREE.BoxGeometry(0.2, 0.04, 0.014), BRASS, g);
      slot.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.05); slot.rotation.z = a;
    }
    const hat = solid(new THREE.CylinderGeometry(0.22, 0.22, 0.18, 36), BRASS, g); hat.rotation.x = Math.PI / 2; hat.position.z = 0.1;
    const caliper = solid(new THREE.RoundedBoxGeometry(0.42, 0.2, 0.34, 3, 0.04), 0xb0281e, g);
    const piston = solid(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 16), BRASS, caliper); piston.rotation.x = Math.PI / 2;
    const padA = solid(new THREE.BoxGeometry(0.28, 0.18, 0.04), LEATHER, g);
    const padB = solid(new THREE.BoxGeometry(0.28, 0.18, 0.04), LEATHER, g);
    const home = { caliper: [0, 0.5, 0], padA: [0, 0.5, 0.06], padB: [0, 0.5, -0.06] };
    const out = { caliper: [0, 1.05, 0], padA: [0, 0.5, 0.55], padB: [0, 0.5, -0.55] };
    const items = [['padA', padA], ['padB', padB], ['caliper', caliper]];
    return {
      group: g, disc, parts: [disc, disc2, hat, caliper, padA, padB],
      /** @param {number[]} k 每个零件的爆炸量 [padA, padB, caliper] */
      explode(k) { items.forEach(([n, m], i) => m.position.set(...home[n].map((v, j) => lerp(v, out[n][j], k[i])))); },
    };
  };

  /**
   * 鼓式制动（蓝图爆炸图）：底板 + 两只制动蹄 + 回位弹簧 + 轮缸 + 制动鼓。轴沿 Z。
   * @returns {{group:THREE.Group, explode:(k:number[])=>void, shoes:THREE.Mesh[], drum:THREE.Group}}
   */
  ME.drumBrake = function () {
    const g = new THREE.Group();
    const plate = solid(new THREE.CylinderGeometry(0.56, 0.56, 0.04, 64), IRON, g); plate.rotation.x = Math.PI / 2; plate.position.z = -0.14;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      const b = solid(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), BRASS, g);
      b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48, -0.1);
    }
    const shoeL = solid(arcBand(0.4, 0.46, Math.PI * 0.58, Math.PI * 1.42, 0.16), LEATHER, g);
    const shoeR = solid(arcBand(0.4, 0.46, -Math.PI * 0.42, Math.PI * 0.42, 0.16), LEATHER, g);
    const cyl = solid(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 20), BRASS, g); cyl.rotation.z = Math.PI / 2; cyl.position.set(0, 0.38, 0);
    const coil = [];
    for (let i = 0; i <= 140; i++) { const a = i / 140 * Math.PI * 2 * 8; coil.push(v3([-0.2 + i / 140 * 0.4, -0.32 + Math.cos(a) * 0.028, Math.sin(a) * 0.028])); }
    const spring = solid(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 220, 0.007, 6), IRON, g);
    const drum = new THREE.Group(); g.add(drum);
    const shell = solid(new THREE.CylinderGeometry(0.56, 0.56, 0.24, 72, 1, true), IRON, drum); shell.rotation.x = Math.PI / 2;
    const face = solid(new THREE.CylinderGeometry(0.56, 0.56, 0.025, 72), IRON, drum); face.rotation.x = Math.PI / 2; face.position.z = 0.12;
    const lip = solid(new THREE.TorusGeometry(0.56, 0.02, 8, 64), BRASS, drum); lip.position.z = 0.12;
    const cap = solid(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24), BRASS, drum); cap.rotation.x = Math.PI / 2; cap.position.z = 0.15;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const b = solid(new THREE.CylinderGeometry(0.028, 0.028, 0.03, 8), BRASS, drum);
      b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0.145);
    }
    return {
      group: g, shoes: [shoeL, shoeR], drum,
      /** @param {number[]} k [drum, shoes, spring+cyl] */
      explode(k) {
        drum.position.z = lerp(0, 0.95, k[0]);
        shoeL.position.set(lerp(0, -0.38, k[1]), 0, lerp(0, 0.38, k[1]));
        shoeR.position.set(lerp(0, 0.38, k[1]), 0, lerp(0, 0.38, k[1]));
        spring.position.set(0, lerp(0, -0.32, k[2]), lerp(0, 0.65, k[2]));
        cyl.position.set(0, lerp(0.38, 0.75, k[2]), lerp(0, 0.65, k[2]));
      },
    };
  };

  /**
   * 福特 T 型车脚下：变速箱壳 + 三块踏板 + 手刹 + 壳内行星齿轮鼓与制动带 + 拉杆。踏板向 -Z（驾驶员在 +Z）。
   * @returns {{group:THREE.Group, pedals:THREE.Group[], hand:THREE.Group, band:THREE.Mesh, drum:THREE.Mesh, rods:THREE.Mesh[], setPedal:(i:number,k:number)=>void, setHand:(k:number)=>void}}
   */
  ME.modelT = function () {
    const g = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const plank = solid(new THREE.BoxGeometry(2.35, 0.05, 0.2), WOOD, g);
      plank.position.set(0, -0.15, -0.55 + i * 0.22);
    }
    const housing = solid(new THREE.CylinderGeometry(0.58, 0.58, 1.35, 48, 1, true, 1.9, Math.PI * 1.55), IRON, g); housing.rotation.z = Math.PI / 2; housing.position.set(0.05, 0.05, -0.85);
    [-0.62, 0.72].forEach((x) => { const cap = solid(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 48), BRASS, g); cap.rotation.z = Math.PI / 2; cap.position.set(x, 0.05, -0.85); });
    const drums = [-0.4, 0.05, 0.42].map((x) => { const d = solid(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 40), BRASS, g); d.rotation.z = Math.PI / 2; d.position.set(x, 0.05, -0.85); return d; });
    const band = solid(arcBand(0.41, 0.46, -1.2, Math.PI * 1.55, 0.16), LEATHER, g);
    band.rotation.y = Math.PI / 2; band.position.set(0.42, 0.05, -0.85);
    const shaft = solid(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 14), IRON, g); shaft.rotation.z = Math.PI / 2; shaft.position.set(0.05, 0.72, -0.15);
    const rods = [];
    const pedals = [-0.42, 0.02, 0.46].map((x, i) => {
      const p = new THREE.Group(); p.position.set(x, 0.72, -0.15); g.add(p);
      const brake = i === 2;
      const armW = brake ? 0.1 : 0.072;
      const padW = brake ? 0.36 : 0.24;
      const padColor = brake ? 0xb0281e : RUBBER;
      const collar = solid(new THREE.CylinderGeometry(0.06, 0.06, brake ? 0.2 : 0.14, 18), BRASS, p);
      collar.rotation.z = Math.PI / 2;
      const hinge = [0, -0.52, 0.22];
      const toe = [0, -0.78, 0.58];
      const half = armW * 0.38;
      [-half, half].forEach((dx) => strap([dx, -0.03, 0.02], [dx, hinge[1], hinge[2]], 0.02, 0.032, IRON, p));
      const pin = solid(new THREE.CylinderGeometry(0.028, 0.028, padW * 0.92, 14), BRASS, p);
      pin.rotation.z = Math.PI / 2; pin.position.set(hinge[0], hinge[1], hinge[2]);
      strap(hinge, toe, padW, 0.028, IRON, p);
      const foot = strap([hinge[0], hinge[1] + 0.02, hinge[2] + 0.015], [toe[0], toe[1] + 0.012, toe[2] - 0.01], padW * 0.88, 0.02, padColor, p);
      for (let r = 0; r < 4; r++) {
        const k = 0.22 + r * 0.18;
        const rib = solid(new THREE.BoxGeometry(padW * 0.8, 0.012, 0.016), padColor, p);
        rib.position.set(
          hinge[0] + (toe[0] - hinge[0]) * k,
          hinge[1] + (toe[1] - hinge[1]) * k + 0.028,
          hinge[2] + (toe[2] - hinge[2]) * k,
        );
        rib.quaternion.copy(foot.quaternion);
      }
      const rodA = [0, -0.28, 0.1], rodB = [0, -0.42, -0.55];
      const rod = M.cyl(rodA, rodB, 0.014, STAGE.toon(IRON), 8);
      rod.userData.base = IRON; p.add(rod); rods.push(rod);
      const clevis = solid(new THREE.SphereGeometry(0.03, 12, 8), BRASS, p);
      clevis.position.set(rodA[0], rodA[1], rodA[2]);
      const eye = solid(new THREE.SphereGeometry(0.026, 12, 8), BRASS, p);
      eye.position.set(rodB[0], rodB[1], rodB[2]);
      return p;
    });
    const hand = new THREE.Group(); hand.position.set(-0.95, -0.08, 0.05); g.add(hand);
    const boot = solid(new THREE.BoxGeometry(0.12, 0.06, 0.16), IRON, hand); boot.position.y = 0.02;
    const lever = solid(new THREE.BoxGeometry(0.045, 1.15, 0.04), IRON, hand); lever.position.y = 0.58;
    const knob = solid(new THREE.SphereGeometry(0.07, 16, 12), WOOD, hand); knob.position.y = 1.18;
    return {
      group: g, pedals, hand, band, drum: drums[2], rods,
      setPedal(i, k) { pedals[i].rotation.x = 0.06 * k; if (i === 2) band.scale.setScalar(1 - 0.04 * k); },
      setHand(k) { hand.rotation.z = -0.35 * k; },
    };
  };

  /**
   * 俯视底盘：两根纵梁 + 横梁 + 四个车轮。车头 +X。
   * @param {{len?:number, track?:number, mat?:THREE.Material, wheelMat?:THREE.Material}} [o]
   * @returns {{group:THREE.Group, wheels:THREE.Group[], pos:number[][], frame:THREE.Mesh[]}}
   */
  ME.chassis = function (o = {}) {
    const len = o.len ?? 4, tr = o.track ?? 1.7, mat = o.mat, wm = o.wheelMat ?? mat;
    const g = new THREE.Group(), frame = [];
    [-0.42, 0.42].forEach((z) => { const r = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.1, 0.1), mat); r.position.set(0, 0, z); g.add(r); frame.push(r); });
    [-1.4, -0.3, 0.8, 1.6].forEach((x) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.84), mat); c.position.set(x * len / 4, 0, 0); g.add(c); frame.push(c); });
    const pos = [[len * 0.36, tr / 2], [len * 0.36, -tr / 2], [-len * 0.36, tr / 2], [-len * 0.36, -tr / 2]];
    const wheels = pos.map(([x, z]) => {
      const w = new THREE.Group(); w.position.set(x, 0, z); g.add(w);
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 40), wm); tire.rotation.x = Math.PI / 2; w.add(tire);
      const axle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, Math.abs(z) - 0.42), mat); axle.position.z = -Math.sign(z) * (Math.abs(z) - 0.42) / 2; w.add(axle);
      frame.push(tire, axle);
      return w;
    });
    return { group: g, wheels, pos, frame };
  };

  /**
   * 液体管材质：沿管长（uv.x）充满到 uFill；前沿有 3 个错相位的鼓包（顶点沿法线外推）。
   * @param {number} color @param {number} radius 管半径（鼓包幅度按它算）
   */
  ME.fluidMaterial = function (color, radius) {
    return new THREE.ShaderMaterial({
      uniforms: { uFill: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uR: { value: radius }, uLen: { value: 1 } },
      vertexShader: `
        uniform float uFill, uTime, uR, uLen; varying vec2 vUv; varying vec3 vN;
        void main(){
          vUv = uv; vN = normalize(normalMatrix * normal);
          float d = (uFill - uv.x) * uLen;
          float b = 0.0;
          for (int i = 0; i < 3; i++) { float c = 0.05 + float(i) * 0.09; b += exp(-pow((d - c) / 0.03, 2.0)) * (0.55 + 0.35 * sin(uTime * 7.0 + float(i) * 2.1)); }
          vec3 p = position + normal * uR * 0.6 * b * step(0.0, d);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uFill; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN;
        void main(){
          if (vUv.x > uFill) discard;
          float l = 0.65 + 0.35 * clamp(dot(normalize(vN), normalize(vec3(0.3, 0.8, 0.5))), 0.0, 1.0);
          gl_FragColor = vec4(uColor * l, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  };

  /**
   * 一根可充液的管：外层玻璃管 + 内层液体（共用路径）。
   * @param {number[][]} pts @param {{r?:number, glass?:THREE.Material, fluid?:number}} [o]
   * @returns {{group:THREE.Group, fluid:THREE.ShaderMaterial, curve:THREE.Curve, len:number}}
   */
  ME.pipe = function (pts, o = {}) {
    const r = o.r ?? 0.035;
    const curve = new THREE.CatmullRomCurve3(pts.map(v3), false, 'catmullrom', 0.05);
    const g = new THREE.Group();
    const segs = Math.max(40, Math.round(curve.getLength() * 60));
    if (o.glass) g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r, 12), o.glass));
    const fm = ME.fluidMaterial(o.fluid ?? 0xb0281e, r * 0.7);
    fm.uniforms.uLen.value = curve.getLength();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, r * 0.7, 10), fm));
    return { group: g, fluid: fm, curve, len: curve.getLength() };
  };

  /**
   * 真空助力器剖面：旋转体外壳（被平面剖开）+ 膜片 + 推杆 + 主缸。轴沿 X，踏板在 -X。
   * @param {{shell:THREE.Material, inner:THREE.Material, accent:THREE.Material, clip:THREE.Plane}} o
   * @returns {{group:THREE.Group, setPush:(k:number)=>void, diaphragm:THREE.Mesh}}
   */
  ME.booster = function (o) {
    const g = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; prof.push(new THREE.Vector2(0.06 + Math.sin(a) * 0.94, -0.42 + (1 - Math.cos(a)) * 0.42)); }
    const shellMat = o.shell.clone(); shellMat.clippingPlanes = [o.clip]; shellMat.side = THREE.DoubleSide;
    const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), shellMat); shell.rotation.z = -Math.PI / 2; g.add(shell);
    const diaMat = o.accent.clone(); diaMat.clippingPlanes = [o.clip]; diaMat.side = THREE.DoubleSide;
    const dprof = [new THREE.Vector2(0.06, 0), new THREE.Vector2(0.6, 0.02), new THREE.Vector2(0.85, 0.08), new THREE.Vector2(0.97, 0.0)];
    const diaphragm = new THREE.Mesh(new THREE.LatheGeometry(dprof, 72), diaMat); diaphragm.rotation.z = -Math.PI / 2; g.add(diaphragm);
    const rodIn = M.cyl([-1.5, 0, 0], [-0.1, 0, 0], 0.04, o.inner); g.add(rodIn);
    const rodOut = M.cyl([0, 0, 0], [1.1, 0, 0], 0.05, o.inner); g.add(rodOut);
    const mc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 32), o.shell); mc.rotation.z = Math.PI / 2; mc.position.x = 1.35; g.add(mc);
    return {
      group: g, diaphragm,
      setPush(k) { diaphragm.position.x = 0.16 * k; rodIn.position.x = 0.16 * k; rodOut.position.x = 0.16 * k; },
    };
  };

  /**
   * 赛车通风盘 + 卡钳 + 钢丝轮辋（海报卡通材质）。盘面法线沿 Z。
   * @param {{disc:THREE.Material, caliper:THREE.Material, rim:THREE.Material, tire:THREE.Material}} m
   * @returns {{group:THREE.Group, rotor:THREE.Group, setHeat:(h:number)=>void, discMat:THREE.Material}}
   */
  ME.ventDisc = function (m) {
    const g = new THREE.Group(), rotor = new THREE.Group(); g.add(rotor);
    const discMat = m.disc.clone();
    [-0.045, 0.045].forEach((z) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.03, 72), discMat); d.rotation.x = Math.PI / 2; d.position.z = z; rotor.add(d); });
    const vanes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.025, 0.06), discMat, 36);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a + 0.3); mm.compose(v3([Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0]), q, v3([1, 1, 1])); vanes.setMatrixAt(i, mm); }
    rotor.add(vanes);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.22, 32), m.rim); hat.rotation.x = Math.PI / 2; hat.position.z = 0.14; rotor.add(hat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 24), m.rim); cap.rotation.x = Math.PI / 2; cap.position.z = 0.26; rotor.add(cap);
    for (let side = 0; side < 2; side++) {
      const hz = side ? 0.2 : 0.06;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + side * (Math.PI / 16);
        const s = M.cyl([Math.cos(a) * 0.2, Math.sin(a) * 0.2, hz], [Math.cos(a) * 0.84, Math.sin(a) * 0.84, 0.12], 0.016, m.rim, 6);
        rotor.add(s);
      }
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.055, 12, 80), m.rim); rim.position.z = 0.12; rotor.add(rim);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.2, 18, 90), m.tire); tire.position.z = 0.12; tire.scale.z = 1.45; rotor.add(tire);
    const cal = new THREE.Mesh(new THREE.RoundedBoxGeometry(0.42, 0.3, 0.3, 3, 0.06), m.caliper); cal.position.set(0.5, 0.25, 0); cal.rotation.z = 0.5; g.add(cal);
    return {
      group: g, rotor, discMat,
      setHeat(h) {
        const c = new THREE.Color(0x56606a).lerp(new THREE.Color(1.0, 0.32, 0.08), clamp(h));
        discMat.color.copy(c);
        if (discMat.emissive) discMat.emissive.setRGB(2.2 * h * h, 0.5 * h * h, 0.1 * h * h);
      },
    };
  };

  /**
   * 雪铁龙 DS 蘑菇头制动按钮（地板上的橡胶帽）。
   * @param {{rubber:THREE.Material, base:THREE.Material}} m
   * @returns {{group:THREE.Group, setPress:(k:number)=>void}}
   */
  ME.mushroom = function (m) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.08, 48), m.base); base.position.y = 0.04; g.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 24), m.base); stem.position.y = 0.16; g.add(stem);
    const prof = [];
    for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; prof.push(new THREE.Vector2(Math.sin(a) * 0.3, Math.cos(a) * 0.14)); }
    prof.push(new THREE.Vector2(0.3, -0.04), new THREE.Vector2(0.0, -0.04));
    const cap = new THREE.Mesh(new THREE.LatheGeometry(prof.reverse(), 48), m.rubber); cap.position.y = 0.26; g.add(cap);
    return { group: g, setPress(k) { cap.position.y = 0.26 - 0.06 * k; cap.scale.set(1 + 0.04 * k, 1 - 0.12 * k, 1 + 0.04 * k); } };
  };

  /**
   * 沿曲线跑的信号脉冲（加色小光点）。
   * @param {number} n 数量 @param {number} color
   * @returns {{points:THREE.Points, place:(curves:THREE.Curve[], t:number, speed:number, reach?:number)=>void}}
   */
  ME.pulses = function (n, color) {
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = STAGE.canvasTexture(64, 64, (c) => {
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
    });
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    return {
      points,
      /** 每条曲线均分 n/曲线数 个点，按时间循环；reach 为可到达的最远比例 */
      place(curves, t, speed, reach = 1) {
        const per = Math.max(1, Math.floor(n / curves.length));
        for (let i = 0; i < n; i++) {
          const c = curves[i % curves.length], j = Math.floor(i / curves.length);
          const u = ((t * speed + j / per) % 1) * reach;
          const p = c.getPointAt(clamp(u));
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  };

  window.ME = ME;
})();
