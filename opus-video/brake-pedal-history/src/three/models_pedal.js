/**
 * 主角模型：现代吊挂式刹车踏板总成（可断裂）+ 公共建模工具 + 截图卡片。
 * 单位约 10 cm；转轴在原点，踏板臂向 -Y 下垂，驾驶员在 +Z 一侧，前围板在 -Z。
 */
(function () {
  const M = {};

  /** 两点之间放一根圆柱 @param {number[]} a @param {number[]} b @param {number} r @param {THREE.Material} mat @param {number} [seg] */
  M.cyl = function (a, b, r, mat, seg = 16) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return m;
  };

  /** 让已有圆柱（高度 1）连接两点 @param {THREE.Mesh} m @param {THREE.Vector3} va @param {THREE.Vector3} vb */
  M.stretch = function (m, va, vb) {
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    m.scale.set(1, va.distanceTo(vb), 1);
  };

  /** 折线 → Shape @param {number[][]} pts @param {number[][][]} [holes] */
  M.shape = function (pts, holes = []) {
    const s = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], p[1])));
    holes.forEach((h) => s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1])))));
    return s;
  };

  /** 圆形孔点列 */
  M.circlePts = (cx, cy, r, n = 24) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos(-i / n * Math.PI * 2), cy + r * Math.sin(-i / n * Math.PI * 2)]);

  /**
   * 侧视图（u=z, v=y）的形状沿 X 挤出，居中于 x0。
   * @param {THREE.Shape} shape @param {number} depth @param {number} x0 @param {number} [bevel]
   */
  M.extrudeSide = function (shape, depth, x0 = 0, bevel = 0.012) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 24 });
    g.rotateY(-Math.PI / 2);
    g.translate(x0 + depth / 2, 0, 0);
    g.computeVertexNormals();
    return g;
  };

  /** 固定种子随机 */
  const R = (seed) => L.rng(seed);

  /** 地毯/织物噪声贴图 */
  M.fabricTexture = function (base = '#1a1b1e', seed = 5) {
    return STAGE.canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const r = R(seed);
      for (let i = 0; i < 26000; i++) {
        const v = Math.floor(r() * 40);
        g.fillStyle = `rgba(${v + 20},${v + 20},${v + 24},0.35)`;
        g.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
      }
    });
  };

  /** 金属拉丝粗糙度贴图 */
  M.brushedTexture = function (seed = 9) {
    const t = STAGE.canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#888'; g.fillRect(0, 0, w, h);
      const r = R(seed);
      for (let i = 0; i < 900; i++) { const v = 100 + r() * 100; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, r() * h, w, 0.6 + r()); }
    });
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  };

  /** 公共材质 */
  M.mats = function () {
    if (M._mats) return M._mats;
    const brushed = M.brushedTexture();
    M._mats = {
      zinc: new THREE.MeshStandardMaterial({ color: 0x8b929b, metalness: 0.9, roughness: 0.46, roughnessMap: brushed }),
      plastic: new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0, roughness: 0.55 }),
      weld: new THREE.MeshStandardMaterial({ color: 0x5d5a55, metalness: 0.8, roughness: 0.6 }),
      wire: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, metalness: 0, roughness: 0.4 }),
      ecoat: new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.2, roughness: 0.62 }),
      composite: new THREE.MeshPhysicalMaterial({ color: 0x24272b, metalness: 0.0, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.6 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x0e0f10, metalness: 0, roughness: 0.92 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.16 }),
      steelRaw: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.3 }),
      fracture: new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.7, roughness: 0.85 }),
      hot: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.75, 0.35), transparent: true, opacity: 1, toneMapped: false }),
    };
    return M._mats;
  };

  /** 支架裂纹（侧视 u=z, v=y），固定种子 */
  function crackLine() {
    const r = R(4589), pts = [];
    const z0 = -0.9, z1 = 0.474, n = 14;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const j = (i === 0 || i === n) ? 0 : (r() - 0.5) * 0.11;
      pts.push([z0 + (z1 - z0) * k, 0.62 + j]);
    }
    return pts;
  }

  /** 踏板臂侧视轮廓（中心线贝塞尔 + 变宽偏移） */
  function armOutline() {
    const P = (k) => {
      const a = [0, 0], b = [0.04, -1.2], c = [0.16, -2.2], d = [0.55, -2.78];
      const u = 1 - k;
      return [u * u * u * a[0] + 3 * u * u * k * b[0] + 3 * u * k * k * c[0] + k * k * k * d[0], u * u * u * a[1] + 3 * u * u * k * b[1] + 3 * u * k * k * c[1] + k * k * k * d[1]];
    };
    const L1 = [], L2 = [], N = 28;
    for (let i = 0; i <= N; i++) {
      const k = i / N, p = P(k), q = P(Math.min(1, k + 0.01)), o = P(Math.max(0, k - 0.01));
      const tx = q[0] - o[0], ty = q[1] - o[1], tl = Math.hypot(tx, ty);
      const nx = -ty / tl, ny = tx / tl, hw = 0.17 - 0.07 * k;
      L1.push([p[0] + nx * hw, p[1] + ny * hw]); L2.push([p[0] - nx * hw, p[1] - ny * hw]);
    }
    return { pts: L1.concat(L2.reverse()), center: P };
  }

  /**
   * 踏板总成。
   * @param {{composite?:boolean, stress?:boolean}} [o]
   * @returns {{group:THREE.Group, upper:THREE.Group, lower:THREE.Group, arm:THREE.Group, pad:THREE.Mesh, meshes:THREE.Mesh[], crack:number[][],
   *   setPress:(a:number)=>void, setBreak:(k:number, tau:number)=>void, pinWorld:()=>THREE.Vector3, padLocal:number[]}}
   */
  M.pedal = function (o = {}) {
    const mt = M.mats();
    const group = new THREE.Group(), upper = new THREE.Group(), lower = new THREE.Group(), arm = new THREE.Group();
    group.add(upper); group.add(lower); lower.add(arm);
    const meshes = [];
    const add = (parent, mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); meshes.push(mesh); return mesh; };
    const crack = crackLine();

    const upperPts = [[-0.9, 0.9], [0.55, 0.9], [0.474, 0.62], ...crack.slice().reverse().slice(1, -1), [-0.9, 0.62]];
    const lowerPts = [[-0.9, 0.62], ...crack.slice(1, -1), [0.474, 0.62], [0.4, 0.35], [0.3, -0.15], [0.12, -0.3], [-0.12, -0.3], [-0.3, -0.15], [-0.6, 0.3], [-0.9, 0.5]];
    const lowerHoles = [M.circlePts(0, 0, 0.075), [[-0.48, 0.44], [-0.14, 0.44], [-0.3, 0.16]]];
    [-0.34, 0.34].forEach((x) => {
      add(upper, new THREE.Mesh(M.extrudeSide(M.shape(upperPts), 0.05, x), mt.zinc));
      add(lower, new THREE.Mesh(M.extrudeSide(M.shape(lowerPts, lowerHoles), 0.05, x), mt.zinc));
    });
    const top = add(upper, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.86, 0.06, 1.6, 2, 0.02), mt.zinc));
    top.position.set(0, 0.93, -0.18);
    [[-0.28, -0.75], [0.28, -0.75], [-0.28, 0.4], [0.28, 0.4]].forEach(([x, z]) => {
      const b = add(upper, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), mt.chrome));
      b.position.set(x, 0.985, z);
      const w = add(upper, new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 24), mt.chrome));
      w.position.set(x, 0.962, z);
    });
    const shaft = add(lower, M.cyl([-0.46, 0, 0], [0.46, 0, 0], 0.055, mt.chrome, 24));
    [-0.46, 0.46].forEach((x) => { const n = add(lower, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), mt.chrome)); n.rotation.z = Math.PI / 2; n.position.set(x * 1.06, 0, 0); });

    // 焊缝：顶板与侧板交界
    const beads = [];
    [-0.312, 0.312].forEach((x) => { for (let z = -0.86; z <= 0.5; z += 0.045) beads.push([x, 0.9, z]); });
    const weld = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), mt.weld, beads.length);
    const wm = new THREE.Matrix4();
    beads.forEach((p, i) => { wm.makeScale(1, 0.7, 1.5); wm.setPosition(p[0], p[1], p[2]); weld.setMatrixAt(i, wm); });
    weld.castShadow = true; upper.add(weld);

    // 前横梁 + 刹车灯开关 + 线束
    const bridge = add(lower, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.66, 0.2, 0.04, 2, 0.01), mt.zinc));
    bridge.position.set(0, 0.42, 0.36); bridge.rotation.x = -0.25;
    const sw = add(lower, M.cyl([0.16, 0.34, 0.36], [0.16, 0.3, 0.12], 0.05, mt.plastic, 20));
    const swNut = add(lower, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 6), mt.chrome));
    swNut.position.set(0.16, 0.335, 0.33); swNut.rotation.x = Math.PI / 2 - 0.15;
    const plug = add(lower, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.13, 0.1, 0.14, 2, 0.015), mt.plastic));
    plug.position.set(0.16, 0.38, 0.47);
    const harness = new THREE.CatmullRomCurve3([[0.16, 0.4, 0.54], [0.18, 0.55, 0.6], [0.2, 0.78, 0.5], [0.24, 1.02, 0.2], [0.3, 1.25, -0.5], [0.34, 1.5, -1.3]].map((p) => new THREE.Vector3(...p)));
    add(upper, new THREE.Mesh(new THREE.TubeGeometry(harness, 60, 0.022, 8), mt.wire));

    // 踏板位置传感器（转轴右端）
    const sensor = add(lower, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.1, 0.3, 0.24, 2, 0.03), mt.plastic));
    sensor.position.set(0.58, 0, 0.02);
    const sPlug = add(lower, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.08, 0.1, 0.12, 2, 0.015), mt.plastic));
    sPlug.position.set(0.6, 0.17, 0.08);

    // 扭簧（套在转轴上，臂毂与侧板之间）
    const coil = [];
    for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2 * 4.5; coil.push(new THREE.Vector3(-0.3 + i / 160 * 0.085, Math.cos(a) * 0.1, Math.sin(a) * 0.1)); }
    coil.push(new THREE.Vector3(-0.21, -0.1, 0.22), new THREE.Vector3(-0.2, -0.28, 0.26));
    add(lower, new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 400, 0.013, 6), mt.ecoat));

    const ao = armOutline();
    const armMat = o.composite ? mt.composite : mt.ecoat;
    const armMesh = add(arm, new THREE.Mesh(M.extrudeSide(M.shape(ao.pts), o.composite ? 0.2 : 0.13, 0, 0.02), armMat));
    const boss = add(arm, M.cyl([-0.2, 0, 0], [0.2, 0, 0], 0.2, armMat, 32));
    if (o.composite) {
      for (let i = 1; i < 9; i++) {
        const k = i / 9, p = ao.center(k);
        const rib = add(arm, new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.3 - 0.1 * k), armMat));
        rib.position.set(0, p[1], p[0]);
      }
    }
    const clevis = add(arm, M.cyl([-0.12, -0.72, 0.02], [0.12, -0.72, 0.02], 0.045, mt.chrome));
    const padCenter = [0, -2.98, 0.66];
    const pad = add(arm, new THREE.Mesh(new THREE.RoundedBoxGeometry(1.0, 0.68, 0.12, 4, 0.05), mt.ecoat));
    pad.position.set(...padCenter);
    pad.rotation.x = -0.28;
    const padRubber = new THREE.Group();
    pad.add(padRubber);
    const rub = add(padRubber, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.92, 0.6, 0.04, 3, 0.03), mt.rubber));
    rub.position.z = 0.07;
    for (let i = 0; i < 6; i++) { const r = add(padRubber, new THREE.Mesh(new THREE.RoundedBoxGeometry(0.8, 0.04, 0.03, 2, 0.012), mt.rubber)); r.position.set(0, -0.22 + i * 0.088, 0.095); }

    const hot = new THREE.Group();
    [-0.34, 0.34].forEach((x) => {
      const curve = new THREE.CatmullRomCurve3(crack.map(([z, y]) => new THREE.Vector3(x + (x > 0 ? 0.03 : -0.03), y, z)), false, 'catmullrom', 0.1);
      hot.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.012, 6), mt.hot));
    });
    hot.visible = false;
    group.add(hot);

    const debris = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.03), mt.fracture, 46);
    debris.castShadow = true;
    const r = R(1612);
    const shards = Array.from({ length: 46 }, (_, i) => {
      const c = crack[Math.floor(r() * crack.length)];
      const side = r() > 0.5 ? 0.34 : -0.34;
      return { p: [side, c[1], c[0]], v: [side * (2 + r() * 4), 0.5 + r() * 2.2, (r() - 0.3) * 2.5], s: 0.5 + r() * 1.6, rot: [r() * 6, r() * 6, r() * 6], w: [(r() - 0.5) * 20, (r() - 0.5) * 20, (r() - 0.5) * 20] };
    });
    debris.visible = false;
    group.add(debris);
    const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler(), dp = new THREE.Vector3(), ds = new THREE.Vector3();

    const api = {
      group, upper, lower, arm, pad, meshes, crack, hot, debris, padLocal: padCenter, armMesh,
      /** 踩下角度（弧度，正值为踏板向前围板转） */
      setPress(a) { arm.rotation.x = a; },
      /**
       * 断裂进度：k 为脱落的弹簧进度（0..1+），tau 为断裂后经过的（慢放）秒数，用于碎片抛物线。
       */
      /**
       * @param {number} k 脱落进度
       * @param {number} tau 断裂后的时间
       * @param {{absX?:boolean, dir?:number, fly?:number}} [o] 只给第 6 章用：碎片往一侧飞，别飘进左侧文案
       */
      setBreak(k, tau, o = {}) {
        lower.position.set(0.02 * k, -0.55 * k, 0.12 * k);
        lower.rotation.set(0.75 * k, 0.05 * k, -0.12 * k);
        hot.visible = tau > 0 && tau < 1.6;
        hot.children.forEach((m) => { m.material.opacity = Math.max(0, 1 - tau / 1.6); });
        debris.visible = tau > 0;
        if (tau > 0) {
          const fly = o.fly ?? 1;
          shards.forEach((s, i) => {
            const vx = (o.absX ? Math.abs(s.v[0]) * (o.dir ?? 1) : s.v[0]) * fly;
            const vy = s.v[1] * fly;
            const vz = s.v[2] * (o.absX ? 0.35 : 1) * fly;
            const grav = o.absX ? 1.8 : 4.9;
            dp.set(s.p[0] + vx * tau, s.p[1] + vy * tau - grav * tau * tau, s.p[2] + vz * tau);
            de.set(s.rot[0] + s.w[0] * tau, s.rot[1] + s.w[1] * tau, s.rot[2] + s.w[2] * tau);
            dq.setFromEuler(de); ds.setScalar(s.s * (o.absX ? 0.7 : 1));
            dm.compose(dp, dq, ds); debris.setMatrixAt(i, dm);
          });
          debris.instanceMatrix.needsUpdate = true;
        }
      },
      /** 推杆销的世界坐标 */
      pinWorld() { return new THREE.Vector3(0, -0.72, 0.02).applyMatrix4(arm.matrixWorld); },
    };
    return api;
  };

  /**
   * 驾驶舱脚坑：倾斜地毯 + 前围板 + 推杆。
   * @returns {{group:THREE.Group, update:(pedal:object)=>void}}
   */
  M.footwell = function () {
    const g = new THREE.Group();
    const carpet = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 1, map: M.fabricTexture('#18191b', 3) });
    carpet.map.wrapS = carpet.map.wrapT = THREE.RepeatWrapping; carpet.map.repeat.set(4, 4);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), carpet);
    floor.rotation.x = -Math.PI / 2 + 0.32; floor.position.set(0, -3.75, 0.5); floor.receiveShadow = true; g.add(floor);
    const fw = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), new THREE.MeshStandardMaterial({ color: 0x0e0f11, roughness: 0.85, metalness: 0.1 }));
    fw.position.set(0, -1, -1.45); fw.receiveShadow = true; g.add(fw);
    const mt = M.mats();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12), mt.chrome); rod.castShadow = true; g.add(rod);
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.25, 20), mt.rubber); boot.rotation.x = Math.PI / 2; boot.position.set(0, -0.72, -1.33); g.add(boot);
    return {
      group: g,
      update(p) {
        p.group.updateMatrixWorld(true);
        const a = p.pinWorld();
        const b = new THREE.Vector3(0, -0.72, -1.3);
        g.worldToLocal(a); M.stretch(rod, a, b);
      },
    };
  };

  /**
   * 空气浮尘：固定种子的粒子，按 t 闭式漂移。
   * @param {number} n @param {number[]} min @param {number[]} max @param {number} seed
   * @returns {{points:THREE.Points, update:(t:number)=>void}}
   */
  M.dust = function (n, min, max, seed = 7) {
    const r = R(seed);
    const base = Array.from({ length: n }, () => [lerp(min[0], max[0], r()), lerp(min[1], max[1], r()), lerp(min[2], max[2], r()), r() * 6.28, 0.3 + r() * 0.7]);
    const pos = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const tex = STAGE.canvasTexture(64, 64, (c, w, h) => {
      const gr = c.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(0, 0, w, h);
    });
    const points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.035, map: tex, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff1e0 }));
    return {
      points,
      update(t) {
        base.forEach((b, i) => {
          pos[i * 3] = b[0] + Math.sin(t * 0.21 * b[4] + b[3]) * 0.25;
          pos[i * 3 + 1] = b[1] + Math.sin(t * 0.13 * b[4] + b[3] * 2) * 0.18 + t * 0.012;
          pos[i * 3 + 2] = b[2] + Math.cos(t * 0.17 * b[4] + b[3]) * 0.22;
        });
        g.attributes.position.needsUpdate = true;
      },
    };
  };
  const lerp = (a, b, k) => a + (b - a) * k;

  /**
   * 截图卡片：白边纸片 + 截图贴图，可投影。
   * @param {HTMLImageElement} img @param {number} width 世界宽度
   * @returns {THREE.Group & {userData:{w:number,h:number}}}
   */
  M.card = function (img, width) {
    const h = width * img.height / img.width;
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.BoxGeometry(width + 0.08, h + 0.08, 0.012), new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.9 }));
    back.castShadow = true; back.receiveShadow = true; g.add(back);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ map: STAGE.imageTexture(img), toneMapped: false }));
    face.position.z = 0.0075; g.add(face);
    g.userData = { w: width, h, img };
    return g;
  };

  /** 截图像素坐标 → 卡片局部坐标 @param {THREE.Group} card @param {number} px @param {number} py */
  M.cardPoint = (card, px, py) => {
    const { w, h, img } = card.userData;
    return [(px / img.width - 0.5) * w, (0.5 - py / img.height) * h, 0.012];
  };

  window.M = M;
})();
