import * as T from "three";
import { createPiece, preloadPieces, type PieceSet } from "./pieces";
import {
  evaluate,
  particle,
  clamp,
  type Frame,
  shortsFraming,
} from "../core/timeline";
import { buildGame, type Game } from "../core/chess";
import { type Project, type Format } from "../core/project";
const symbols: Record<string, string> = {
  book: "▤",
  brilliant: "!!",
  best: "★",
  good: "✓",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
};
export class Scene {
  readonly renderer: T.WebGLRenderer;
  readonly ready: Promise<void>;
  private scene = new T.Scene();
  private root = new T.Group();
  private camera = new T.OrthographicCamera();
  private backgroundScene = new T.Scene();
  private backgroundCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private background: T.Mesh;
  private squares: T.Mesh[] = [];
  private labels: T.Sprite[] = [];
  private rim: T.Mesh;
  private meshes = new Map<string, T.Mesh>();
  private shadows = new Map<string, T.Mesh>();
  private assetTextures = new Map<string, T.Texture>();
  private paths: T.Mesh[] = [];
  private trail: T.Mesh;
  private badge: T.Sprite;
  private badgeGlow: T.Sprite;
  private badgeRing: T.Mesh;
  private halo: T.Mesh;
  private snow: T.Points;
  private bursts: T.Points;
  private game: Game | undefined;
  private project: Project | undefined;
  private width = 1;
  private height = 1;
  private layout: { x: number; y: number; w: number; h: number } | null = null;
  private badgeKey = "";
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      stencil: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor("#111918");
    this.scene.add(this.root);
    this.backgroundCamera.position.z = 2;
    this.background = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        uniforms: {
          top: { value: new T.Color("#223431") },
          vignette: { value: 0 },
          vignetteTint: { value: new T.Color("#080c0b") },
          bottom: { value: new T.Color("#101615") },
        },
        vertexShader:
          "varying vec2 v; void main(){v=uv;gl_Position=vec4(position,1.);}",
        fragmentShader:
          "varying vec2 v;uniform vec3 top;uniform vec3 bottom;uniform float vignette;uniform vec3 vignetteTint;void main(){vec3 c=mix(bottom,top,v.y*.7+.3);c*=1.-.22*length(v-.5);c=mix(c,vignetteTint,smoothstep(.15,.72,length(v-.5))*vignette);gl_FragColor=vec4(pow(c,vec3(1./2.2)),1.);}",
      }),
    );
    this.backgroundScene.add(this.background);
    const light = new T.DirectionalLight("#ffffff", 2.2);
    light.position.set(-5, 8, 18);
    this.scene.add(light, new T.AmbientLight("#ffffff", 1.4));
    this.rim = new T.Mesh(
      new T.BoxGeometry(8.22, 8.22, 0.11),
      new T.MeshStandardMaterial({ color: "#414b44", roughness: 0.75 }),
    );
    this.rim.position.z = -0.08;
    this.root.add(this.rim);
    for (let rank = 0; rank < 8; rank++)
      for (let file = 0; file < 8; file++) {
        const square = new T.Mesh(
          new T.PlaneGeometry(1, 1),
          new T.MeshBasicMaterial({
            stencilWrite: true,
            stencilRef: 1,
            stencilFunc: T.AlwaysStencilFunc,
            stencilZPass: T.ReplaceStencilOp,
          }),
        );
        square.position.set(file - 3.5, rank - 3.5, 0);
        square.userData.dark = (file + rank) % 2 === 0;
        this.root.add(square);
        this.squares.push(square);
      }
    for (let i = 0; i < 64; i++) {
      const m = new T.Mesh(
        new T.PlaneGeometry(0.99, 0.99),
        new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
      );
      m.position.z = 0.012;
      m.visible = false;
      this.paths.push(m);
      this.root.add(m);
    }
    this.trail = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.root.add(this.trail);
    this.halo = new T.Mesh(
      new T.PlaneGeometry(2, 2),
      new T.MeshBasicMaterial({
        map: this.radial(),
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    this.root.add(this.halo);
    this.badge = new T.Sprite(
      new T.SpriteMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.badge.renderOrder = 30;
    this.root.add(this.badge);
    this.badgeGlow = new T.Sprite(
      new T.SpriteMaterial({
        map: this.radial(),
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: T.AdditiveBlending,
        color: "#a6d797",
      }),
    );
    this.badgeGlow.renderOrder = 28;
    this.root.add(this.badgeGlow);
    this.badgeRing = new T.Mesh(
      new T.RingGeometry(0.4, 0.42, 64),
      new T.MeshBasicMaterial({
        transparent: true,
        side: T.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    this.root.add(this.badgeRing);
    const makePoints = (count: number) => {
      const geo = new T.BufferGeometry();
      geo.setAttribute(
        "position",
        new T.Float32BufferAttribute(new Float32Array(count * 3), 3),
      );
      geo.setAttribute(
        "alpha",
        new T.Float32BufferAttribute(new Float32Array(count), 1),
      );
      geo.setAttribute(
        "size",
        new T.Float32BufferAttribute(new Float32Array(count), 1),
      );
      return new T.Points(
        geo,
        new T.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: {
            color: { value: new T.Color("#ffffff") },
            softness: { value: 0.5 },
            pixels: { value: 70 },
          },
          vertexShader:
            "attribute float alpha;attribute float size;varying float a;uniform float pixels;void main(){a=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,size*pixels);}",
          fragmentShader:
            "uniform vec3 color;uniform float softness;varying float a;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(color,a*(1.-smoothstep(1.-softness,1.,d)));}",
        }),
      );
    };
    this.snow = makePoints(400);
    this.snow.frustumCulled = false;
    this.bursts = makePoints(36);
    this.bursts.frustumCulled = false;
    this.scene.add(this.snow);
    this.root.add(this.bursts);
    this.ready = this.prepare();
  }
  private async prepare() {
    await preloadPieces();
    for (const set of ["merida", "cburnett", "neo"] as PieceSet[])
      for (const color of ["w", "b"])
        for (const type of "kqrbnp") {
          const m = await createPiece(set, color, type);
          this.meshes.set(`template-${set}-${color}-${type}`, m);
        }
  }
  private radial() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!,
      g = x.createRadialGradient(64, 64, 1, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,.8)");
    g.addColorStop(0.4, "rgba(255,255,255,.25)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(c);
  }
  async setAsset(id: string, url: string) {
    const tex = await new T.TextureLoader().loadAsync(url);
    tex.colorSpace = T.SRGBColorSpace;
    this.assetTextures.get(id)?.dispose();
    this.assetTextures.set(id, tex);
    this.badgeKey = "";
  }
  removeAsset(id: string) {
    this.assetTextures.get(id)?.dispose();
    this.assetTextures.delete(id);
    this.badgeKey = "";
  }
  private badgeTexture(kind: string, text: string) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const x = c.getContext("2d")!;
    const colors: Record<string, string> = {
      book: "#9d9772",
      brilliant: "#54c8d8",
      best: "#96b56d",
      good: "#7aa180",
      inaccuracy: "#e7c36a",
      mistake: "#e79a5d",
      blunder: "#dd6d70",
    };
    x.shadowColor = colors[kind] ?? "#aa9ee4";
    x.shadowBlur = 20;
    x.fillStyle = colors[kind] ?? "#aa9ee4";
    x.beginPath();
    x.arc(128, 128, 99, 0, Math.PI * 2);
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = "#ffffff";
    x.font = "bold 112px system-ui";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(kind === "custom" ? text : (symbols[kind] ?? kind), 128, 132);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }
  private rebuildCoordinates(p: Project) {
    for (const s of this.labels) {
      this.root.remove(s);
      (s.material as T.SpriteMaterial).map?.dispose();
      s.material.dispose();
    }
    this.labels = [];
    if (!p.style.coordinates) return;
    for (let i = 0; i < 8; i++)
      for (const file of [true, false]) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d")!;
        x.font = "38px system-ui";
        x.fillStyle = "#d9dfd1";
        x.textAlign = "center";
        x.fillText(file ? String.fromCharCode(97 + i) : String(i + 1), 32, 45);
        const s = new T.Sprite(
          new T.SpriteMaterial({
            map: new T.CanvasTexture(c),
            depthTest: false,
          }),
        );
        s.scale.set(0.23, 0.23, 1);
        s.position.set(file ? i - 3.5 : -4.23, file ? -4.23 : i - 3.5, 0.15);
        this.labels.push(s);
        this.root.add(s);
      }
  }
  render(
    p: Project,
    time: number,
    w: number,
    h: number,
    format: Format = p.format,
  ): Frame {
    const changed = this.project !== p;
    if (changed) {
      if (this.project?.style.coordinates !== p.style.coordinates)
        this.rebuildCoordinates(p);
      this.project = p;
      this.game = buildGame(p);
    }
    const e = evaluate(p, time, this.game, format);
    const fx = p.boardFX;
    const short = format === "vertical" && p.shorts.enabled;
    if (fx.intro && fx.introPreset !== "still" && time < p.lead) {
      const u = Math.min(1, time / Math.min(p.lead, fx.introDuration)),
        k = u * u * (3 - 2 * u);
      if (fx.introPreset !== "turn")
        e.camera.zoom = fx.introZoom + (e.camera.zoom - fx.introZoom) * k;
      if (fx.introPreset !== "zoom")
        e.camera.rotation += fx.introTurn * (1 - k);
    }
    const shimmer = fx.enabled
      ? 1 +
        fx.shimmer *
          (0.55 * Math.sin(time * fx.shimmerSpeed * 6.283) +
            0.3 * Math.sin(time * fx.shimmerSpeed * 10.17) +
            0.15 * Math.sin(time * fx.shimmerSpeed * 17.33))
      : 1;

    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      this.renderer.setSize(w, h, false);
    }
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, w, h);
    this.renderer.setClearColor(short ? p.shorts.barColor : "#111918");
    this.renderer.clear(true, true, true);
    const bg = p.layouts[format],
      bgMat = this.background.material as T.ShaderMaterial;
    bgMat.uniforms.top.value
      .set(p.style.background)
      .multiplyScalar(bg.background === "solid" ? 1 : 1.5);
    bgMat.uniforms.bottom.value
      .set(p.style.background)
      .multiplyScalar(
        (bg.background === "solid" ? 1 : 0.7) *
          (1 -
            (fx.enabled
              ? fx.vignette *
                (0.5 + 0.5 * Math.sin(time * fx.vignetteSpeed * 6.283))
              : 0)),
      );
    if (fx.enabled)
      bgMat.uniforms.bottom.value.lerp(
        new T.Color(fx.vignetteColor ?? "#080c0b"),
        fx.vignette * (0.5 + 0.5 * Math.sin(time * fx.vignetteSpeed * 6.283)),
      );
    bgMat.uniforms.vignette.value = fx.enabled
      ? fx.vignette * (0.5 + 0.5 * Math.sin(time * fx.vignetteSpeed * 6.283))
      : 0;
    bgMat.uniforms.vignetteTint.value.set(fx.vignetteColor ?? "#080c0b");
    if (!short)
      this.renderer.render(this.backgroundScene, this.backgroundCamera);
    const image = bg.image ? this.assetTextures.get(bg.image) : null;
    if (!short && image && bg.background === "image") {
      const m = new T.Mesh(
        new T.PlaneGeometry(2, 2),
        new T.MeshBasicMaterial({ map: image }),
      );
      const aspect = image.image.width / image.image.height,
        out = w / h;
      if (aspect > out) m.scale.x = aspect / out;
      else m.scale.y = out / aspect;
      this.backgroundScene.add(m);
      this.renderer.render(this.backgroundScene, this.backgroundCamera);
      this.backgroundScene.remove(m);
      m.geometry.dispose();
      (m.material as T.Material).dispose();
    }
    const square = format === "square-in-vertical",
      crop = short ? shortsFraming(p, e.camera, w, h) : null,
      viewH = crop ? crop.viewH : square ? w : h,
      viewY = crop
        ? crop.viewY
        : square
          ? Math.round((h - w) / 2 + (bg.y * w) / 8)
          : 0;
    this.layout = { x: 0, y: viewY, w, h: viewH };
    this.root.rotation.z = p.style.orientation === "white" ? 0 : Math.PI;
    const sign = p.style.orientation === "white" ? 1 : -1,
      aspect = w / viewH,
      half = 4.65 / Math.max(0.1, e.camera.zoom * bg.zoom);
    this.camera.left = -(crop?.halfX ?? half * Math.max(1, aspect));
    this.camera.right = crop?.halfX ?? half * Math.max(1, aspect);
    this.camera.top = crop?.halfY ?? half * Math.max(1, 1 / aspect);
    this.camera.bottom = -(crop?.halfY ?? half * Math.max(1, 1 / aspect));
    this.camera.near = 0.1;
    this.camera.far = 100;
    const x = (crop ? crop.x : e.camera.x + bg.x) * sign,
      y = (crop ? crop.y : e.camera.y + (square ? 0 : bg.y)) * sign,
      tilt = (e.camera.tilt * Math.PI) / 180;
    this.camera.position.set(x, y + Math.sin(tilt) * 25, Math.cos(tilt) * 25);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(x, y, 0);
    this.camera.rotateZ((e.camera.rotation * Math.PI) / 180);
    this.camera.updateProjectionMatrix();
    (this.rim.material as T.MeshStandardMaterial).color.set(p.style.rim);
    (this.rim.material as T.MeshStandardMaterial).emissive
      .set(fx.rimColor ?? p.style.accent)
      .multiplyScalar(
        fx.enabled
          ? fx.rim * (0.5 + 0.5 * Math.sin(time * fx.rimSpeed * 6.283))
          : 0,
      );
    for (const s of this.squares) {
      const m = s.material as T.MeshBasicMaterial;
      m.color.set(s.userData.dark ? p.style.dark : p.style.light);
      m.color.multiplyScalar(shimmer);
      if (fx.enabled)
        m.color.lerp(
          new T.Color(fx.lightingColor ?? "#ffffff"),
          fx.shimmer * 0.12,
        );
      if (fx.enabled && fx.sweep) {
        const wave = Math.exp(
          -Math.pow(
            (s.position.x +
              s.position.y * 0.4 -
              (((time * fx.sweepSpeed * 12) % 20) - 10)) /
              1.8,
            2,
          ),
        );
        m.color.lerp(new T.Color(fx.sweepColor ?? "#ffffff"), wave * fx.sweep);
      }
      if (s.userData.dark && fx.enabled && fx.beatClock) {
        const beat = ((time * fx.bpm) / 60) % 1,
          level = Math.exp(((-beat * (60 / fx.bpm)) / fx.beatDecay) * 4);
        m.color.lerp(new T.Color(fx.beatColor), level * fx.beatStrength);
      }

      if (s.userData.dark) m.color.lerp(new T.Color(p.pulse.color), e.pulse);
    }
    for (const m of this.paths) m.visible = false;
    if (e.effect) {
      const hl = e.effect.highlight;
      const fade = hl.persist
        ? 1
        : clamp(1 - (time - segmentsFinish(p, e.index)) / hl.fade);
      const reveal = clamp((e.u - hl.reveal) / 0.12);
      for (const s of e.path) {
        const isFrom = s === e.source,
          isTo = s === e.destination;
        if (
          !(
            (isFrom && hl.showSource) ||
            (isTo && hl.showDestination) ||
            (!isFrom && !isTo && hl.showPath)
          )
        )
          continue;
        const i = (Number(s[1]) - 1) * 8 + s.charCodeAt(0) - 97,
          m = this.paths[i];
        m.visible = true;
        m.position.x = s.charCodeAt(0) - 97 - 3.5;
        m.position.y = Number(s[1]) - 1 - 3.5;
        const mat = m.material as T.MeshBasicMaterial;
        mat.color.set(isFrom ? hl.source : isTo ? hl.destination : hl.path);
        mat.opacity = hl.opacity * fade * reveal;
        mat.color.multiplyScalar(1 + hl.glow * 0.3);
      }
    }
    for (const [k, m] of this.meshes)
      if (!k.startsWith("template-")) m.visible = false;
    for (const m of this.shadows.values()) m.visible = false;
    for (const v of e.pieces) {
      const key = `${p.style.pieceSet}-${v.id}-${v.type}`;
      let m = this.meshes.get(key);
      if (!m) {
        const template = this.meshes.get(
          `template-${p.style.pieceSet}-${v.color}-${v.type}`,
        );
        if (!template) continue;
        m = template.clone();
        m.material = (template.material as T.Material[]).map((x) => x.clone());
        this.meshes.set(key, m);
        this.root.add(m);
      }
      m.visible = v.opacity > 0.001;
      m.position.set(v.x, v.y, 0.08 + v.z);
      m.rotation.set(v.rx, v.ry, v.rz + (sign < 0 ? Math.PI : 0));
      m.scale.setScalar(v.scale);
      for (const mat of m.material as T.Material[]) {
        mat.opacity = v.opacity;
        mat.transparent = true;
      }
      let shadow = this.shadows.get(v.id);
      if (!shadow) {
        shadow = new T.Mesh(
          new T.PlaneGeometry(1.05, 0.75),
          new T.MeshBasicMaterial({
            map: this.radial(),
            color: "#111916",
            transparent: true,
            depthWrite: false,
          }),
        );
        this.shadows.set(v.id, shadow);
        this.root.add(shadow);
      }
      shadow.visible = m.visible;
      shadow.position.set(v.x + 0.035, v.y - 0.04, 0.021);
      shadow.scale.setScalar(v.scale * (1 + v.z * 0.12));
      (shadow.material as T.MeshBasicMaterial).opacity =
        (0.2 * v.opacity) / (1 + v.z);
    }
    this.trail.visible = e.trail.length > 1;
    this.trail.geometry.dispose();
    const ribbon: number[] = [],
      indices: number[] = [];
    e.trail.forEach(([x, y], i) => {
      const prev = e.trail[Math.max(0, i - 1)],
        next = e.trail[Math.min(e.trail.length - 1, i + 1)],
        dx = next[0] - prev[0],
        dy = next[1] - prev[1],
        len = Math.hypot(dx, dy) || 1,
        width =
          (e.effect?.highlight.width ?? 0.13) *
          (0.2 + (0.8 * i) / Math.max(1, e.trail.length - 1));
      ribbon.push(
        x - (dy / len) * width,
        y + (dx / len) * width,
        0.025,
        x + (dy / len) * width,
        y - (dx / len) * width,
        0.025,
      );
      if (i) {
        const j = i * 2;
        indices.push(j - 2, j - 1, j, j - 1, j + 1, j);
      }
    });
    this.trail.geometry = new T.BufferGeometry();
    this.trail.geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(ribbon, 3),
    );
    this.trail.geometry.setIndex(indices);
    const tm = this.trail.material as T.MeshBasicMaterial;
    tm.color.set(e.effect?.highlight.path ?? "#b1a6ef");
    tm.opacity = e.effect?.highlight.opacity ?? 0;
    const active =
      e.pieces.find((v) => v.moving) ??
      e.pieces.find((v) => v.square === e.destination);
    this.halo.visible = e.glow > 0.001 && !!active;
    if (active) {
      this.halo.position.set(active.x, active.y, 0.04);
      this.halo.scale.setScalar(e.effect?.capture.radius ?? 1);
      const m = this.halo.material as T.MeshBasicMaterial;
      m.color.set(e.effect?.capture.color ?? "#72dce0");
      m.opacity = e.glow * 0.6;
    }
    this.badge.visible = !!e.badge && !!e.badgePosition;
    this.badgeRing.visible = false;
    this.badgeGlow.visible = this.badge.visible;
    if (e.badge && e.badgePosition && e.effect) {
      const b = e.effect.badge,
        key = e.badge + b.text + (p.badgeAssets[e.badge] ?? "");
      if (key !== this.badgeKey) {
        const mat = this.badge.material as T.SpriteMaterial;
        mat.map =
          this.assetTextures.get(p.badgeAssets[e.badge]) ??
          this.badgeTexture(e.badge, b.text);
        mat.needsUpdate = true;
        this.badgeKey = key;
      }
      const entry = clamp((e.u - b.start) / 0.12),
        entryScale = b.entry === "pop" ? 0.6 + 0.4 * easeLocal(entry) : 1;
      this.badge.position.set(
        e.badgePosition[0],
        e.badgePosition[1] + (b.entry === "rise" ? (1 - entry) * -0.25 : 0),
        0.45,
      );
      this.badge.scale.setScalar(b.size * entryScale);
      this.badgeGlow.position.copy(this.badge.position);
      this.badgeGlow.scale.setScalar(b.size * 2.5);
      (this.badgeGlow.material as T.SpriteMaterial).opacity =
        b.glow * b.opacity * 0.5;
      (this.badge.material as T.SpriteMaterial).opacity =
        b.opacity * (b.entry === "fade" ? entry : 1);
      if (b.ring) {
        this.badgeRing.visible = true;
        this.badgeRing.position.copy(this.badge.position);
        this.badgeRing.scale.setScalar(b.size * (1 + entry * 0.9));
        const m = this.badgeRing.material as T.MeshBasicMaterial;
        m.color.set(p.style.accent);
        m.opacity = (1 - entry) * b.opacity * 0.65;
      }
    }
    const positions = this.snow.geometry.attributes.position,
      alphas = this.snow.geometry.attributes.alpha,
      pointSizes = this.snow.geometry.attributes.size;
    for (let i = 0; i < 400; i++) {
      const a = particle(i, time, p.ambient);
      positions.setXYZ(
        i,
        a.x * (p.ambient.insideBoard ? 2 / 3 : 1),
        a.y * (p.ambient.insideBoard ? 2 / 3 : 1),
        p.ambient.layer === "behind"
          ? -1 - a.z
          : p.ambient.layer === "over"
            ? 0.3 + a.z
            : i % 2
              ? -0.8 - a.z
              : 0.3 + a.z,
      );
      alphas.setX(i, p.ambient.enabled && i < p.ambient.count ? a.alpha : 0);
      pointSizes.setX(i, a.size);
    }
    positions.needsUpdate = alphas.needsUpdate = pointSizes.needsUpdate = true;
    const sm = this.snow.material as T.ShaderMaterial;
    sm.stencilWrite = p.ambient.insideBoard;
    sm.stencilRef = 1;
    sm.stencilFunc = T.EqualStencilFunc;
    sm.stencilFail = sm.stencilZFail = sm.stencilZPass = T.KeepStencilOp;
    // Stencil clips every fragment, including the flake edges, to visible squares.
    this.snow.renderOrder = p.ambient.insideBoard ? 10 : 0;
    sm.uniforms.color.value.set(p.ambient.color);
    sm.uniforms.softness.value = p.ambient.softness;
    sm.uniforms.pixels.value = viewH / (this.camera.top - this.camera.bottom);
    const bp = this.bursts.geometry.attributes.position,
      ba = this.bursts.geometry.attributes.alpha,
      bs = this.bursts.geometry.attributes.size;
    for (let i = 0; i < 36; i++) {
      const t = Math.max(0, e.u - (e.effect?.capture.impact ?? 1)),
        angle = i * 2.39996,
        r = t * (1 + (i % 5)) * 3;
      bp.setXYZ(
        i,
        (active?.x ?? 0) + Math.cos(angle) * r,
        (active?.y ?? 0) + Math.sin(angle) * r,
        0.4,
      );
      ba.setX(i, e.effect?.capture.particles ? e.impact * 0.4 : 0);
      bs.setX(i, 0.035);
    }
    bp.needsUpdate = ba.needsUpdate = bs.needsUpdate = true;
    (this.bursts.material as T.ShaderMaterial).uniforms.color.value.set(
      e.effect?.capture.color ?? "#ffffff",
    );
    (this.bursts.material as T.ShaderMaterial).uniforms.pixels.value =
      viewH / 9;
    if (square || short) {
      this.root.visible = false;
      this.renderer.clearDepth();
      if (!short) this.renderer.render(this.scene, this.camera);
      this.root.visible = true;
      this.renderer.setViewport(0, viewY, w, viewH);
      this.renderer.setScissor(0, viewY, w, viewH);
      this.renderer.setScissorTest(true);
    }
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setScissorTest(false);
    return e;
  }
  pick(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect(),
      l = this.layout;
    if (!l) return null;
    const px = ((clientX - rect.left) / rect.width) * this.width,
      py = (1 - (clientY - rect.top) / rect.height) * this.height;
    if (py < l.y || py > l.y + l.h) return null;
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(((px - l.x) / l.w) * 2 - 1, ((py - l.y) / l.h) * 2 - 1),
      this.camera,
    );
    const hit = ray.intersectObjects(this.squares)[0];
    if (!hit) return null;
    const point = this.root.worldToLocal(hit.point.clone()),
      f = Math.floor(point.x + 4),
      r = Math.floor(point.y + 4);
    return f >= 0 && f < 8 && r >= 0 && r < 8
      ? String.fromCharCode(97 + f) + (r + 1)
      : null;
  }
  rgba() {
    const gl = this.renderer.getContext(),
      raw = new Uint8Array(this.width * this.height * 4),
      out = new Uint8Array(raw.length);
    gl.readPixels(
      0,
      0,
      this.width,
      this.height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      raw,
    );
    for (let y = 0; y < this.height; y++)
      out.set(
        raw.subarray(y * this.width * 4, (y + 1) * this.width * 4),
        (this.height - y - 1) * this.width * 4,
      );
    return out;
  }
  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    for (const t of this.assetTextures.values()) t.dispose();
  }
}
function easeLocal(t: number) {
  return t * t * (3 - 2 * t);
}
function segmentsFinish(p: Project, i: number) {
  let t = p.lead;
  for (let j = 0; j <= i; j++)
    t +=
      p.moves[j].effect.delay +
      p.moves[j].effect.duration +
      (j < i ? p.moves[j].effect.hold : 0);
  return t;
}
