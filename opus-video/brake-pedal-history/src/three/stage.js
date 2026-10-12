/**
 * 3D 舞台：共用一个 WebGLRenderer；每个场景自带合成管线（渲染 → 可选辉光 → 可选网点 → 胶片颗粒/暗角 → 输出）。
 * 画面只由 t 决定：场景代码每帧设置变换后调用 STAGE.draw()。
 */
(function () {
  const W = 1920, H = 1080;
  const STAGE = { W, H, used: false, MSAA: 4, LITE: /lite=1/.test(location.search) };

  /** 胶片：颗粒（按帧号取种子）+ 暗角 + 轻微色差 */
  const FilmShader = {
    uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 }, uGrain: { value: 0.06 }, uVig: { value: 0.35 }, uAberr: { value: 0.0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uFrame, uGrain, uVig, uAberr; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uFrame * 0.6180339) * 43758.5453); }
      void main(){
        vec2 d = (vUv - 0.5);
        vec4 c = texture2D(tDiffuse, vUv);
        if (uAberr > 0.0) { c.r = texture2D(tDiffuse, vUv + d * uAberr).r; c.b = texture2D(tDiffuse, vUv - d * uAberr).b; }
        float g = h(floor(vUv * vec2(960.0, 540.0))) - 0.5;
        c.rgb += g * uGrain;
        float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 0.8)));
        c.rgb *= mix(1.0 - uVig, 1.0, v);
        gl_FragColor = c;
      }`,
  };

  /** 网点海报：按亮度在暗部叠旋转网点，并做色阶分离 */
  const HalftoneShader = {
    uniforms: { tDiffuse: { value: null }, uInk: { value: null }, uCell: { value: 9.0 }, uLevels: { value: 5.0 }, uAmt: { value: 1.0 } },
    vertexShader: FilmShader.vertexShader,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform vec3 uInk; uniform float uCell, uLevels, uAmt; varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        vec3 q = floor(c.rgb * uLevels + 0.5) / uLevels;
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        vec2 p = vUv * vec2(1920.0, 1080.0);
        float a = 0.26; mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
        vec2 g = r * p / uCell; vec2 f = fract(g) - 0.5;
        float rad = sqrt(clamp(1.0 - l * 1.25, 0.0, 1.0)) * 0.62;
        float dotm = 1.0 - smoothstep(rad - 0.06, rad + 0.06, length(f));
        vec3 o = mix(q, q * uInk, dotm * 0.55);
        gl_FragColor = vec4(mix(c.rgb, o, uAmt), c.a);
      }`,
  };

  /** 全屏四边形 */
  function fsQuad(material) {
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    return { render(r) { r.render(mesh, cam); }, material };
  }

  /**
   * 墨线描边通道：额外渲染一遍法线+深度，按 Sobel 式邻域差检测轮廓和折痕，叠成等宽墨线。
   * @param {THREE.Scene} scene @param {THREE.Camera} camera @param {{color?:number, width?:number, depth?:number, normal?:number}} o
   */
  function inkPass(scene, camera, o) {
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
    rt.depthTexture = new THREE.DepthTexture(W, H);
    const nm = new THREE.MeshNormalMaterial();
    const q = fsQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tN: { value: rt.texture }, tD: { value: rt.depthTexture }, uInk: { value: new THREE.Color(o.color ?? 0x2a2118) },
        uPx: { value: new THREE.Vector2((o.width ?? 1.2) / W, (o.width ?? 1.2) / H) }, uNear: { value: 0.05 }, uFar: { value: 500 },
        uDk: { value: o.depth ?? 0.35 }, uNk: { value: o.normal ?? 0.5 }, uAmt: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tN, tD; uniform vec3 uInk; uniform vec2 uPx; uniform float uNear, uFar, uDk, uNk, uAmt; varying vec2 vUv;
        float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float d0 = lin(texture2D(tD, vUv).r); vec3 n0 = texture2D(tN, vUv).rgb;
          float e = 0.0;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398;
            vec2 o = vec2(cos(a), sin(a)) * uPx;
            float d = lin(texture2D(tD, vUv + o).r); vec3 n = texture2D(tN, vUv + o).rgb;
            e = max(e, smoothstep(uDk * 0.5, uDk, abs(d - d0) / max(d0, 0.5) * 12.0));
            e = max(e, smoothstep(uNk * 0.6, uNk, length(n - n0)));
          }
          gl_FragColor = vec4(mix(c.rgb, uInk, e * uAmt), c.a);
        }`,
      depthTest: false, depthWrite: false,
    }));
    return {
      enabled: true, needsSwap: true, clear: false, renderToScreen: false, uniforms: q.material.uniforms,
      setSize() {}, dispose() {},
      render(r, writeBuffer, readBuffer) {
        const ov = scene.overrideMaterial, bg = scene.background;
        const hidden = [];
        scene.traverse((o) => { if (o.visible && (o.material?.isLineMaterial || o.isPoints || o.userData.noInk)) { o.visible = false; hidden.push(o); } });
        scene.overrideMaterial = nm; scene.background = null;
        r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
        scene.overrideMaterial = ov; scene.background = bg;
        hidden.forEach((o) => { o.visible = true; });
        q.material.uniforms.tDiffuse.value = readBuffer.texture;
        q.material.uniforms.uNear.value = camera.near; q.material.uniforms.uFar.value = camera.far;
        r.setRenderTarget(this.renderToScreen ? null : writeBuffer); q.render(r);
      },
    };
  }

  /**
   * 初始化渲染器。
   * @param {HTMLCanvasElement} canvas
   */
  STAGE.init = function (canvas) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(1);
    r.setSize(W, H, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.localClippingEnabled = true;
    STAGE.renderer = r;
    STAGE.canvas = canvas;
    const pm = new THREE.PMREMGenerator(r);
    STAGE.envRoom = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  };

  /**
   * 给场景建合成管线。
   * @param {THREE.Scene} scene @param {THREE.Camera} camera
   * @param {{bloom?:[number,number,number], halftone?:{ink:number,cell?:number,levels?:number}, grain?:number, vig?:number, aberr?:number, flat?:boolean, exposure?:number}} [o]
   * flat=true 时不做色调映射（纸、蓝图、海报这类要求颜色准确的画风）
   */
  STAGE.pipeline = function (scene, camera, o = {}) {
    if (!STAGE._rt) STAGE._rt = [0, 1].map(() => new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: STAGE.MSAA }));
    const c = new THREE.EffectComposer(STAGE.renderer, STAGE._rt[0]);
    c.renderTarget2.dispose();
    c.renderTarget2 = c.readBuffer = STAGE._rt[1];
    c.setPixelRatio(1);
    c.setSize(W, H);
    c.addPass(new THREE.RenderPass(scene, camera));
    if (o.ao) {
      const g = new THREE.GTAOPass(scene, camera, W, H);
      g.updateGtaoMaterial({ radius: o.ao.radius ?? 0.4, distanceExponent: 1, thickness: 1, scale: 1, samples: 16 });
      g.blendIntensity = o.ao.intensity ?? 1;
      c.addPass(g); c.ao = g;
    }
    if (o.dof) {
      const b = new THREE.BokehPass(scene, camera, { focus: 5, aperture: o.dof.aperture ?? 0.004, maxblur: o.dof.maxblur ?? 0.008 });
      c.addPass(b); c.bokeh = b; c.camera = camera;
    }
    if (o.ink) { const p = inkPass(scene, camera, o.ink); c.addPass(p); c.ink = p; }
    if (o.bloom) { const b = new THREE.UnrealBloomPass(new THREE.Vector2(W / 2, H / 2), o.bloom[0], o.bloom[1], o.bloom[2]); c.addPass(b); c.bloom = b; }
    c.addPass(new THREE.OutputPass());
    if (o.halftone) {
      const ht = new THREE.ShaderPass(HalftoneShader);
      ht.uniforms.uInk.value = new THREE.Color(o.halftone.ink);
      ht.uniforms.uCell.value = o.halftone.cell ?? 9;
      ht.uniforms.uLevels.value = o.halftone.levels ?? 5;
      c.addPass(ht); c.halftone = ht;
    }
    const film = new THREE.ShaderPass(FilmShader);
    film.uniforms.uGrain.value = o.grain ?? 0.06;
    film.uniforms.uVig.value = o.vig ?? 0.35;
    film.uniforms.uAberr.value = o.aberr ?? 0;
    c.addPass(film); c.film = film;
    c.flat = !!o.flat;
    c.exposure = o.exposure ?? 1;
    return c;
  };

  /**
   * 画一帧 3D。
   * @param {EffectComposer} composer @param {number} T 全片时间（颗粒种子）
   */
  STAGE.draw = function (composer, T) {
    composer.film.uniforms.uFrame.value = Math.floor(T * 30);
    STAGE.renderer.toneMapping = composer.flat ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    STAGE.renderer.toneMappingExposure = composer.exposure;
    STAGE.renderer.clippingPlanes = composer.clip || [];
    composer.render();
    STAGE.renderer.clippingPlanes = [];
    STAGE.used = true;
  };

  /**
   * 景深对焦到某个世界坐标点。
   * @param {EffectComposer} composer @param {number[]} point @param {number} [aperture]
   */
  STAGE.focus = function (composer, point, aperture) {
    if (!composer.bokeh) return;
    const cam = composer.camera;
    cam.updateMatrixWorld();
    const p = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(cam.matrixWorldInverse);
    composer.bokeh.uniforms.focus.value = -p.z;
    if (aperture != null) composer.bokeh.uniforms.aperture.value = aperture;
  };

  /**
   * 3D 点投影到屏幕像素。
   * @param {THREE.Vector3|number[]} v 世界坐标 @param {THREE.Camera} camera @returns {{x:number,y:number,z:number}}
   */
  STAGE.project = function (v, camera) {
    const p = Array.isArray(v) ? new THREE.Vector3(v[0], v[1], v[2]) : v.clone();
    camera.updateMatrixWorld();
    p.project(camera);
    return { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, z: p.z };
  };

  /** 物体局部点 → 屏幕 @param {THREE.Object3D} obj @param {number[]} local @param {THREE.Camera} camera */
  STAGE.projectLocal = function (obj, local, camera) {
    obj.updateMatrixWorld(true);
    return STAGE.project(new THREE.Vector3(local[0], local[1], local[2]).applyMatrix4(obj.matrixWorld), camera);
  };

  /**
   * 设置相机：位置、注视点、视角。
   * @param {THREE.PerspectiveCamera} cam @param {number[]} pos @param {number[]} look @param {number} [fov] @param {number} [roll]
   */
  STAGE.aim = function (cam, pos, look, fov, roll = 0) {
    cam.position.set(pos[0], pos[1], pos[2]);
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(look[0], look[1], look[2]);
    if (fov && cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  };

  /** 绕 Y 轴的环绕机位 @returns {number[]} */
  STAGE.orbit = function (target, radius, azimuth, elevation) {
    return [target[0] + radius * Math.cos(elevation) * Math.sin(azimuth), target[1] + radius * Math.sin(elevation), target[2] + radius * Math.cos(elevation) * Math.cos(azimuth)];
  };

  /** 新相机 */
  STAGE.camera = (fov = 35) => new THREE.PerspectiveCamera(fov, W / H, 0.05, 500);

  /**
   * 第 4 章那种奶油底 + 金色放射线。供第 3 章起的场景共用。
   * @param {CanvasRenderingContext2D} g @param {number} w @param {number} h
   */
  STAGE.paintDeco = function (g, w, h) {
    g.fillStyle = '#F2E6CF'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h + 260); g.rotate(-Math.PI / 2);
    for (let i = 0; i < 40; i++) {
      g.rotate(Math.PI / 40);
      g.fillStyle = i % 2 ? 'rgba(184,137,58,0.11)' : 'rgba(184,137,58,0.035)';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-80, -2400); g.lineTo(80, -2400); g.closePath(); g.fill();
    }
    g.restore();
    const r = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 1.05);
    r.addColorStop(0, 'rgba(80,50,20,0)'); r.addColorStop(1, 'rgba(80,50,20,0.22)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  };

  /** 金色放射线背景贴图（1920×1080） */
  STAGE.decoTexture = () => STAGE.canvasTexture(W, H, STAGE.paintDeco);

  /** 用 2D 画布生成贴图（背景纸、蓝图网格等），sRGB @param {(g:CanvasRenderingContext2D,w:number,h:number)=>void} draw */
  STAGE.canvasTexture = function (w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  /** 图片贴图 @param {HTMLImageElement} img */
  STAGE.imageTexture = function (img, max = 1800) {
    let src = img;
    const s = max / Math.max(img.width, img.height);
    if (s < 1) {
      src = document.createElement('canvas');
      src.width = Math.round(img.width * s); src.height = Math.round(img.height * s);
      const g = src.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, src.width, src.height);
    }
    const t = new THREE.Texture(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
  };

  /**
   * 粗描边：从网格提取棱线，作为子物体跟随变换。
   * @param {THREE.Mesh} mesh @param {{color?:number,width?:number,angle?:number,opacity?:number,dashed?:boolean}} [o]
   * @returns {THREE.LineSegments2}
   */
  STAGE.edges = function (mesh, o = {}) {
    const eg = new THREE.EdgesGeometry(mesh.geometry, o.angle ?? 25);
    const g = new THREE.LineSegmentsGeometry().fromEdgesGeometry(eg);
    const m = new THREE.LineMaterial({ color: o.color ?? 0xffffff, linewidth: o.width ?? 2, transparent: true, opacity: o.opacity ?? 1, dashed: !!o.dashed, dashSize: 0.06, gapSize: 0.05 });
    m.resolution.set(W, H);
    const l = new THREE.LineSegments2(g, m);
    if (o.dashed) l.computeLineDistances();
    l.userData.total = g.attributes.instanceStart ? g.attributes.instanceStart.count : 0;
    mesh.add(l);
    return l;
  };

  /** 按进度显示描边的前一部分（模拟逐笔画出） @param {THREE.LineSegments2} l @param {number} p */
  STAGE.reveal = function (l, p) {
    const n = l.userData.total;
    l.geometry.instanceCount = Math.max(0, Math.round(n * Math.min(1, Math.max(0, p))));
    l.visible = p > 0;
  };

  /**
   * 铜版画排线材质：漫反射越暗，排线越密（三层交叉），亮部留白透出纸色。
   * @param {{ink?:number, paper?:number, spacing?:number, light?:number[], amount?:number}} [o]
   */
  STAGE.hatchMaterial = function (o = {}) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uInk: { value: new THREE.Color(o.ink ?? 0x2a2118) }, uPaper: { value: new THREE.Color(o.paper ?? 0xede3cc) },
        uLight: { value: new THREE.Vector3(...(o.light ?? [0.5, 0.8, 0.4])).normalize() }, uSpacing: { value: o.spacing ?? 7.0 },
        uAmount: { value: o.amount ?? 1.0 }, uTint: { value: new THREE.Color(o.tint ?? o.paper ?? 0xede3cc) },
      },
      clipping: true,
      vertexShader: `
        #include <clipping_planes_pars_vertex>
        varying vec3 vN; varying vec3 vW;
        void main(){
          vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
          vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <clipping_planes_vertex>
        }`,
      fragmentShader: `
        #include <clipping_planes_pars_fragment>
        uniform vec3 uInk, uPaper, uLight, uTint; uniform float uSpacing, uAmount; varying vec3 vN; varying vec3 vW;
        float line(vec2 p, float ang, float sp, float w){ vec2 d = vec2(cos(ang), sin(ang)); float v = abs(fract(dot(p, d) / sp) - 0.5) * sp; return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.9, v); }
        void main(){
          #include <clipping_planes_fragment>
          vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          float dif = clamp(dot(n, uLight), 0.0, 1.0) * 0.85 + 0.15;
          float tone = 1.0 - dif;
          vec2 p = gl_FragCoord.xy;
          float a = uAmount;
          float ink = 0.0;
          ink = max(ink, line(p, 0.785, uSpacing, 1.3) * step(0.25, tone * a));
          ink = max(ink, line(p, -0.785, uSpacing, 1.2) * step(0.48, tone * a));
          ink = max(ink, line(p, 0.0, uSpacing * 0.5, 1.0) * step(0.68, tone * a));
          gl_FragColor = vec4(mix(uTint, uInk, ink), 1.0);
          #include <colorspace_fragment>
        }`,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });
  };

  /** 蓝图面：半透明蓝色填充，正面/背面不同亮度 @param {number} [color] @param {number} [opacity] */
  STAGE.blueprintFill = (color = 0x2a5a98, opacity = 0.35) => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });

  /**
   * 卡通分层材质（海报用），3 档明暗。
   * @param {number} color
   */
  STAGE.toon = function (color) {
    const grad = new Uint8Array([70, 150, 255]);
    const tex = new THREE.DataTexture(grad, 3, 1, THREE.RedFormat);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
    return new THREE.MeshToonMaterial({ color, gradientMap: tex });
  };

  /**
   * 应力云图材质：用顶点属性 aStress（0..1）映射蓝→青→黄→红，uLoad 整体缩放。
   */
  STAGE.stressMaterial = function () {
    return new THREE.ShaderMaterial({
      uniforms: { uLoad: { value: 0 }, uLight: { value: new THREE.Vector3(0.4, 0.8, 0.6).normalize() } },
      vertexShader: `
        attribute float aStress; varying float vS; varying vec3 vN;
        void main(){ vS = aStress; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uLoad; uniform vec3 uLight; varying float vS; varying vec3 vN;
        vec3 ramp(float s){
          vec3 a = vec3(0.12,0.28,0.85), b = vec3(0.15,0.75,0.85), c = vec3(0.95,0.85,0.2), d = vec3(0.92,0.22,0.15);
          s = clamp(s, 0.0, 1.0);
          if (s < 0.33) return mix(a, b, s / 0.33);
          if (s < 0.66) return mix(b, c, (s - 0.33) / 0.33);
          return mix(c, d, (s - 0.66) / 0.34);
        }
        void main(){
          float s = floor(vS * uLoad * 10.0) / 10.0;
          float l = clamp(dot(normalize(vN), uLight), 0.0, 1.0) * 0.5 + 0.55;
          gl_FragColor = vec4(ramp(s) * l, 1.0);
          #include <colorspace_fragment>
        }`,
    });
  };

  window.STAGE = STAGE;
})();
