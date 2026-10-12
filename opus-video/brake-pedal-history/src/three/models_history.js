/**
 * 历史章节的程序化模型（第 2–8 章）。
 * 坐标：X 为车头方向，Y 向上，Z 为横向；单位约 1 米。
 */
(function () {
  const MH = {};
  const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);

  /**
   * 铜版画部件集合：网格统一用排线材质（自带材质为 ShaderMaterial 时保留），墨线由管线的描边通道生成。
   * 排线浓度为 0 时只剩纸色 + 墨线（纯线稿），升到 1 即“线转面”。
   * @param {THREE.ShaderMaterial} fill
   */
  function Drawing(fill) {
    const group = new THREE.Group();
    const mats = new Set([fill]);
    return {
      group, fill,
      /** @param {THREE.Mesh} mesh @param {number} _order 预留的绘制顺序 @param {THREE.Object3D} [parent] */
      add(mesh, _order, parent = group) {
        if (!mesh.material || !mesh.material.isShaderMaterial) mesh.material = fill;
        mats.add(mesh.material);
        parent.add(mesh);
        return mesh;
      },
      /** 全部排线材质的浓度 */
      fillAmount(k) { mats.forEach((m) => { m.uniforms.uAmount.value = k; }); },
    };
  }

  /**
   * 辐条车轮（轴向 Z）。
   * @param {ReturnType<Drawing>} d @param {number} r @param {number} spokes @param {number} order @param {number} [w] 轮宽
   */
  function wheel(d, r, spokes, order, w = 0.05) {
    const g = new THREE.Group();
    const tire = d.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.032, 10, 64)), order, g, 40);
    const rim = d.add(new THREE.Mesh(new THREE.TorusGeometry(r - 0.045, 0.014, 6, 64)), order + 0.03, g, 40);
    const hub = d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, w * 2.4, 18)), order + 0.05, g);
    hub.rotation.x = Math.PI / 2;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2, zz = (i % 2 ? 1 : -1) * w * 0.9;
      const s = M.cyl([0, 0, zz], [Math.cos(a) * (r - 0.05), Math.sin(a) * (r - 0.05), 0], 0.007, d.fill, 5);
      d.add(s, order + 0.06 + (i / spokes) * 0.08, g, 60);
    }
    void tire; void rim;
    return g;
  }

  /**
   * 1886 奔驰专利车（铜版画风格：排线材质 + 墨线描边）。
   * @returns {{group:THREE.Group, drawing:object, rearL:THREE.Group, rearR:THREE.Group, front:THREE.Group, lever:THREE.Group,
   *   block:THREE.Group, setLever:(a:number)=>void, setBlock:(k:number)=>void, spin:(a:number)=>void, points:Record<string,number[]>}}
   */
  MH.motorwagen = function () {
    const fill = STAGE.hatchMaterial({ ink: 0x2a2118, paper: 0xede3cc, spacing: 5, light: [0.4, 0.8, 0.5] });
    const wood = STAGE.hatchMaterial({ ink: 0x3a2412, paper: 0xe6d3b0, spacing: 4, light: [0.4, 0.8, 0.5] });
    const d = Drawing(fill);
    const G = d.group;

    // 车轮
    const rearL = wheel(d, 0.56, 18, 0.0), rearR = wheel(d, 0.56, 18, 0.04);
    rearL.position.set(-0.7, 0.56, 0.62); rearR.position.set(-0.7, 0.56, -0.62);
    const front = wheel(d, 0.34, 12, 0.08, 0.035);
    front.position.set(1.28, 0.34, 0);
    G.add(rearL, rearR, front);
    d.add(M.cyl([-0.7, 0.56, -0.7], [-0.7, 0.56, 0.7], 0.022, fill, 10), 0.12);

    // 车架：两根弯管
    [0.36, -0.36].forEach((z, i) => {
      const c = new THREE.CatmullRomCurve3([[1.08, 0.98, z * 0.25], [1.0, 0.62, z * 0.7], [0.55, 0.5, z], [-0.55, 0.5, z], [-1.08, 0.58, z]].map(v3));
      d.add(new THREE.Mesh(new THREE.TubeGeometry(c, 60, 0.024, 8), fill), 0.16 + i * 0.03, G, 50);
    });
    [[0.55, 0.5], [-0.1, 0.5], [-1.0, 0.56]].forEach(([x, y], i) => d.add(M.cyl([x, y, -0.36], [x, y, 0.36], 0.018, fill, 8), 0.2 + i * 0.02));

    // 前叉 + 舵柄
    d.add(M.cyl([1.28, 0.34, 0.06], [1.1, 1.0, 0.03], 0.016, fill, 8), 0.22);
    d.add(M.cyl([1.28, 0.34, -0.06], [1.1, 1.0, -0.03], 0.016, fill, 8), 0.23);
    d.add(M.cyl([1.1, 0.98, 0], [0.82, 1.42, 0], 0.02, fill, 8), 0.26);
    d.add(M.cyl([0.82, 1.42, -0.16], [0.82, 1.42, 0.16], 0.018, fill, 8), 0.3);
    const knob = d.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8)), 0.31);
    knob.position.set(0.82, 1.42, 0.18);

    // 座椅 + 脚踏板（地板）
    const seat = d.add(new THREE.Mesh(new THREE.RoundedBoxGeometry(0.62, 0.14, 0.92, 3, 0.05)), 0.34);
    seat.position.set(0.05, 0.98, 0);
    const back = d.add(new THREE.Mesh(new THREE.RoundedBoxGeometry(0.1, 0.42, 0.92, 3, 0.04)), 0.37);
    back.position.set(-0.28, 1.2, 0); back.rotation.z = 0.18;
    const box = d.add(new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.36, 0.7)), 0.4);
    box.position.set(0.05, 0.74, 0);
    const floor = d.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.64)), 0.42);
    floor.position.set(0.62, 0.55, 0); floor.rotation.z = 0.12;

    // 发动机：卧式飞轮 + 缸体 + 水箱
    const fly = d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 40)), 0.46, G, 40);
    fly.position.set(-0.86, 0.66, 0.05);
    const cylb = d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 18)), 0.5);
    cylb.rotation.z = Math.PI / 2; cylb.position.set(-0.86, 0.82, -0.12);
    const tank = d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 18)), 0.53);
    tank.position.set(-0.98, 1.08, -0.18);

    // 副轴 + 皮带轮 + 链条
    d.add(M.cyl([-0.2, 0.64, -0.62], [-0.2, 0.64, 0.62], 0.016, fill, 8), 0.56);
    const pulley = d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 32)), 0.58, G, 40);
    pulley.rotation.x = Math.PI / 2; pulley.position.set(-0.2, 0.64, 0.2);
    const belt = new THREE.CatmullRomCurve3([[-0.2, 0.77, 0.2], [-0.55, 0.78, 0.15], [-0.86, 0.7, 0.1], [-0.55, 0.52, 0.15], [-0.2, 0.51, 0.2]].map(v3), true);
    d.add(new THREE.Mesh(new THREE.TubeGeometry(belt, 60, 0.012, 6, true), fill), 0.6, G, 60);
    [0.55, -0.55].forEach((z, i) => {
      const ch = new THREE.CatmullRomCurve3([[-0.2, 0.71, z], [-0.45, 0.72, z], [-0.7, 0.71, z], [-0.78, 0.56, z], [-0.7, 0.41, z], [-0.45, 0.48, z], [-0.2, 0.57, z], [-0.13, 0.64, z]].map(v3), true);
      d.add(new THREE.Mesh(new THREE.TubeGeometry(ch, 80, 0.01, 5, true), fill), 0.62 + i * 0.02, G, 60);
    });

    // 手刹杠杆（座椅左侧），绕 Z 轴转
    const lever = new THREE.Group(); lever.position.set(0.32, 0.56, 0.5); G.add(lever);
    d.add(M.cyl([0, 0, 0], [0.04, 0.62, 0], 0.016, fill, 8), 0.66, lever);
    const grip = d.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8)), 0.68, lever);
    grip.position.set(0.04, 0.64, 0);
    const linkRod = d.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 6)), 0.7);
    // 带式制动块（副轴皮带轮上）
    const bandBlock = d.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.11)), 0.72);
    bandBlock.position.set(-0.04, 0.64, 0.2);

    // 木制刹车块（后期版本）：压在后轮胎面前侧
    const block = new THREE.Group(); block.position.set(-0.1, 0.62, 0.62); G.add(block);
    const wb = d.add(new THREE.Mesh(new THREE.RoundedBoxGeometry(0.09, 0.18, 0.08, 2, 0.01), wood), 0.74, block);
    const leather = d.add(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.17, 0.075), STAGE.hatchMaterial({ ink: 0x4a1c10, paper: 0xc9a27a, spacing: 3 })), 0.76, block);
    leather.position.x = -0.054;
    d.add(M.cyl([0.04, 0.05, 0], [0.32, 0.0, -0.12], 0.012, fill, 6), 0.77, block);
    block.visible = false;
    void wb;

    const pivotLink = new THREE.Vector3(), endLink = new THREE.Vector3(-0.02, 0.66, 0.2);
    const api = {
      group: G, drawing: d, rearL, rearR, front, lever, block, leather, wood,
      points: { lever: [0.36, 1.2, 0.5], pulley: [-0.2, 0.64, 0.2], block: [-0.14, 0.62, 0.62], seat: [0.05, 1.05, 0] },
      /** 手刹拉起角度（弧度，向后为正） */
      setLever(a) {
        lever.rotation.z = a;
        lever.updateMatrixWorld(true);
        pivotLink.set(0.0, 0.08, 0).applyMatrix4(lever.matrix);
        bandBlock.position.x = -0.04 - Math.max(0, a) * 0.05;
        M.stretch(linkRod, pivotLink, endLink.set(bandBlock.position.x + 0.03, 0.66, 0.2));
      },
      /** 木刹车块压向轮胎 k（0..1） */
      setBlock(k) { block.visible = k > 0; block.position.x = -0.02 - 0.12 * k; },
      /** 车轮转角 */
      spin(a) { rearL.rotation.z = rearR.rotation.z = a; front.rotation.z = a * 1.65; },
    };
    api.setLever(0);
    return api;
  };

  /**
   * 铜版画地形（贝尔塔之旅）：确定性起伏 + 排线材质，附带一条路线。
   * @returns {{group:THREE.Group, height:(x:number,z:number)=>number, route:THREE.Vector3[], line:any, reveal:(p:number)=>void, mat:THREE.ShaderMaterial}}
   */
  MH.terrain = function () {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uInk: { value: new THREE.Color(0x2a2118) }, uPaper: { value: new THREE.Color(0xede3cc) }, uAmount: { value: 1 } },
      vertexShader: `varying vec3 vW; varying vec3 vN;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uInk, uPaper; uniform float uAmount; varying vec3 vW; varying vec3 vN;
        void main(){
          float h = vW.y * 3.0;
          float fw = fwidth(h);
          float c = 1.0 - smoothstep(0.0, fw * 1.3, abs(fract(h - 0.5) - 0.5));
          float major = 1.0 - smoothstep(0.0, fw * 2.2, abs(fract(h / 5.0 - 0.5) - 0.5) * 5.0);
          float shade = clamp(dot(vN, normalize(vec3(-0.6, 0.7, 0.4))), 0.0, 1.0);
          float slope = 1.0 - vN.y;
          float s = abs(fract((gl_FragCoord.x * 0.7 + gl_FragCoord.y) / 5.0) - 0.5);
          float hatch = (1.0 - smoothstep(0.08, 0.2, s)) * smoothstep(0.05, 0.35, slope) * (1.0 - shade * 0.8);
          float ink = max(max(c * 0.45, major * 0.8), hatch * 0.75) * uAmount;
          float edge = 1.0 - smoothstep(9.0, 18.0, length(vW.xz * vec2(0.7, 1.2)));
          gl_FragColor = vec4(mix(uPaper, uInk, ink * edge), 1.0);
        }`,
      extensions: { derivatives: true },
    });
    const height = (x, z) => {
      const ridge = Math.exp(-Math.pow((x - 9) / 6, 2)) * 2.6;
      return ridge * (0.7 + 0.3 * Math.sin(z * 0.5)) + Math.sin(x * 0.35 + z * 0.2) * 0.35 + Math.sin(x * 0.9 - z * 0.7) * 0.18 + Math.cos(z * 1.3 + x * 0.4) * 0.12;
    };
    const g = new THREE.PlaneGeometry(60, 36, 240, 144);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, height(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, mat);
    mesh.userData.noInk = true;
    const group = new THREE.Group(); group.add(mesh);
    const route = [];
    for (let i = 0; i <= 200; i++) {
      const k = i / 200, x = L.lerp(-14, 13, k), z = Math.sin(k * 5.2) * 2.4 + (k - 0.5) * 3;
      route.push(new THREE.Vector3(x, height(x, z) + 0.06, z));
    }
    const lg = new THREE.LineGeometry(); lg.setPositions(route.flatMap((v) => [v.x, v.y, v.z]));
    const lm = new THREE.LineMaterial({ color: 0x8c2f1b, linewidth: 5 }); lm.resolution.set(1920, 1080);
    const line = new THREE.Line2(lg, lm);
    group.add(line);
    return {
      group, height, route, line, mat,
      reveal(k) { line.geometry.instanceCount = Math.max(0, Math.round((route.length - 1) * L.clamp(k))); line.visible = k > 0; },
    };
  };

  window.MH = MH;
})();
