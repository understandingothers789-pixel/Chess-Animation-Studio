import * as T from "three";
import { pieceMesh } from "./pieces";
import { DIMENSIONS, type Project, type Format } from "../core/model";
import { buildGame, squareXY, type Game } from "../core/chess";
import { evaluate, particle, clamp, type Evaluation } from "../core/timeline";

function textTexture(
  text: string,
  color: string,
  bg?: string,
): T.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  if (bg) {
    x.fillStyle = bg;
    x.beginPath();
    x.arc(128, 128, 116, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = color;
  x.font = `bold ${Math.min(116, Math.round(210 / Math.max(1, text.length * 0.6)))}px Arial`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text.slice(0, 32), 128, 138, 216);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
const symbols: Record<string, [string, string]> = {
  book: ["▤", "#a78969"],
  brilliant: ["!!", "#24ada9"],
  best: ["★", "#6baf65"],
  good: ["✓", "#7d9f76"],
  inaccuracy: ["?!", "#ceaf5a"],
  mistake: ["?", "#d8964d"],
  blunder: ["??", "#c96165"],
  check: ["+", "#8679b9"],
  mate: ["#", "#a078c0"],
};
export class SceneRenderer {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.OrthographicCamera(-8, 8, 4.5, -4.5, 0.1, 100);
  private root = new T.Group();
  private squares: T.Mesh[] = [];
  private highlights: T.Mesh[] = [];
  private atmosphere = new T.Group();
  private pickCamera: T.OrthographicCamera | null = null;
  private squareViewport: { x: number; y: number; size: number } | null = null;
  private pieces = new Map<string, T.Group>();
  private shadows = new Map<string, T.Mesh>();
  private badge: T.Mesh;
  private badgeAura: T.Mesh;
  private ring: T.Mesh;
  private glow: T.Mesh;
  private trail: T.Mesh;
  private snow: T.Points[] = [];
  private impacts: T.Points;
  private background: T.Mesh;
  private game: Game | null = null;
  private lastProject: Project | null = null;
  private badgeTextures = new Map<string, T.Texture>();
  private imageTextures = new Map<string, T.Texture>();
  private imageUrls = new Map<string, string>();
  private coords = new T.Group();
  private w = 0;
  private h = 0;
  private evaluation: Evaluation | null = null;
  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.scene.add(this.root, this.atmosphere);
    this.scene.add(new T.AmbientLight(0xffffff, 2));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(-3, 5, 10);
    this.scene.add(light);
    const rim = new T.Mesh(
      new T.BoxGeometry(8.32, 8.32, 0.18),
      new T.MeshStandardMaterial({ color: "#293c38", roughness: 0.7 }),
    );
    rim.position.z = -0.16;
    this.root.add(rim);
    for (let rank = 0; rank < 8; rank++)
      for (let file = 0; file < 8; file++) {
        const s = new T.Mesh(
          new T.PlaneGeometry(1, 1),
          new T.MeshBasicMaterial(),
        );
        s.position.set(file - 3.5, rank - 3.5, 0);
        this.root.add(s);
        this.squares.push(s);
        const h = new T.Mesh(
          new T.PlaneGeometry(0.98, 0.98),
          new T.MeshBasicMaterial({ transparent: true, depthWrite: false }),
        );
        h.position.copy(s.position);
        h.position.z = 0.012;
        this.root.add(h);
        this.highlights.push(h);
      }
    this.root.add(this.coords);
    for (let i = 0; i < 8; i++)
      for (const axis of ["x", "y"]) {
        const texture = textTexture(
          axis === "x" ? String.fromCharCode(97 + i) : String(i + 1),
          "#aebfb6",
        );
        const label = new T.Mesh(
          new T.PlaneGeometry(0.22, 0.22),
          new T.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          }),
        );
        label.position.set(
          axis === "x" ? i - 3.5 : -4.3,
          axis === "x" ? -4.3 : i - 3.5,
          0.02,
        );
        this.coords.add(label);
      }
    const circle = () =>
      new T.Mesh(
        new T.PlaneGeometry(1, 1),
        new T.MeshBasicMaterial({
          map: this.softTexture(),
          transparent: true,
          depthWrite: false,
        }),
      );
    this.glow = circle();
    this.glow.position.z = 0.04;
    this.root.add(this.glow);
    this.badge = new T.Mesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({ transparent: true, depthTest: false }),
    );
    this.badge.renderOrder = 12;
    this.root.add(this.badge);
    this.badgeAura = circle();
    (this.badgeAura.material as T.MeshBasicMaterial).depthTest = false;
    this.badgeAura.renderOrder = 10;
    this.root.add(this.badgeAura);
    this.ring = new T.Mesh(
      new T.RingGeometry(0.44, 0.48, 64),
      new T.MeshBasicMaterial({
        color: "#81e6e1",
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.ring.renderOrder = 11;
    this.root.add(this.ring);
    this.trail = new T.Mesh(
      new T.BufferGeometry(),
      new T.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.trail.position.z = 0.018;
    this.root.add(this.trail);
    const positions = new Float32Array(900);
    for (let i = 0; i < 2; i++) {
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(positions.slice(), 3));
      geo.setAttribute(
        "particleSize",
        new T.BufferAttribute(new Float32Array(300), 1),
      );
      geo.setAttribute(
        "particleAlpha",
        new T.BufferAttribute(new Float32Array(300), 1),
      );
      const material = new T.ShaderMaterial({
        uniforms: {
          color: { value: new T.Color("white") },
          sizeScale: { value: 50 },
          softness: { value: 0.8 },
        },
        transparent: true,
        depthWrite: false,
        vertexShader:
          "attribute float particleSize; attribute float particleAlpha; uniform float sizeScale; varying float vAlpha; void main(){vAlpha=particleAlpha;gl_PointSize=max(1.,particleSize*sizeScale);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "uniform vec3 color;uniform float softness;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5)*2.;float a=1.-smoothstep(max(0.,1.-softness),1.,d);gl_FragColor=vec4(color,vAlpha*a);\n#include <colorspace_fragment>\n}",
      });
      const snow = new T.Points(geo, material);
      this.atmosphere.add(snow);
      this.snow.push(snow);
    }
    const impactGeo = new T.BufferGeometry();
    impactGeo.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array(24 * 3), 3),
    );
    this.impacts = new T.Points(
      impactGeo,
      new T.PointsMaterial({
        size: 0.055,
        map: this.softTexture(),
        transparent: true,
        depthWrite: false,
      }),
    );
    this.root.add(this.impacts);
    this.background = new T.Mesh(
      new T.PlaneGeometry(120, 120),
      new T.ShaderMaterial({
        uniforms: {
          top: { value: new T.Color("#243b43") },
          bottom: { value: new T.Color("#101b22") },
          image: { value: null },
          hasImage: { value: 0 },
        },
        vertexShader:
          "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec2 vUv; uniform vec3 top; uniform vec3 bottom; uniform sampler2D image; uniform float hasImage; void main(){vec3 c=mix(bottom,top,smoothstep(.42,.62,vUv.y)); if(hasImage>.5)c=texture2D(image,vUv).rgb;gl_FragColor=vec4(c,1.);\n#include <colorspace_fragment>\n}",
        depthWrite: false,
      }),
    );
    this.background.position.z = -4;
    this.scene.add(this.background);
  }
  private softTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, "#ffffffcc");
    g.addColorStop(1, "#ffffff00");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }
  async setAsset(id: string, dataUrl: string) {
    if (this.imageUrls.get(id) === dataUrl && this.imageTextures.has(id))
      return;
    this.imageUrls.set(id, dataUrl);
    const texture = await new T.TextureLoader().loadAsync(dataUrl);
    texture.colorSpace = T.SRGBColorSpace;
    if (this.imageUrls.get(id) !== dataUrl) {
      texture.dispose();
      return;
    }
    this.imageTextures.get(id)?.dispose();
    this.imageTextures.set(id, texture);
  }
  removeAsset(id: string) {
    this.imageTextures.get(id)?.dispose();
    this.imageTextures.delete(id);
    this.imageUrls.delete(id);
  }
  render(
    p: Project,
    time: number,
    width: number,
    height: number,
    format: Format = p.output,
  ): Evaluation {
    if (this.lastProject !== p) {
      this.game = buildGame(p);
      this.lastProject = p;
    }
    const e = evaluate(p, time, this.game!, format);
    this.evaluation = e;
    width = Math.max(2, Math.round(width));
    height = Math.max(2, Math.round(height));
    if (width !== this.w || height !== this.h) {
      this.renderer.setSize(width, height, false);
      this.w = width;
      this.h = height;
    }
    const squareIn = format === "square-in-vertical";
    const layout = p.layouts[format],
      sign = p.style.orientation === "white" ? 1 : -1,
      aspect = squareIn ? 1 : width / height;
    const h = Math.max(9.5, 9.5 / aspect) / (e.camera.zoom * layout.zoom),
      w = h * aspect;
    this.camera.left = -w / 2;
    this.camera.right = w / 2;
    this.camera.top = h / 2;
    this.camera.bottom = -h / 2;
    // Keep the background fixed to the output; world layout changes the composition.
    const cx = e.camera.x * sign + layout.x,
      cy = e.camera.y * sign + (squareIn ? 0 : layout.y);
    const tilt = (e.camera.tilt * Math.PI) / 180;
    this.camera.position.set(cx, cy + Math.sin(tilt) * 20, Math.cos(tilt) * 20);
    this.camera.up.set(
      Math.sin((e.camera.rotation * Math.PI) / 180),
      Math.cos((e.camera.rotation * Math.PI) / 180),
      0,
    );
    this.camera.lookAt(cx, cy, 0);
    this.camera.updateProjectionMatrix();
    this.root.rotation.z = sign < 0 ? Math.PI : 0;
    this.coords.visible = p.style.coordinates;
    this.coords.children.forEach((c) => {
      c.rotation.z = sign < 0 ? Math.PI : 0;
    });
    const bg = this.background.material as T.ShaderMaterial;
    bg.uniforms.bottom.value.set(p.style.background);
    bg.uniforms.top.value
      .set(p.style.background)
      .multiplyScalar(layout.background === "solid" ? 1 : 1.9);
    bg.uniforms.hasImage.value =
      layout.background === "image" &&
      layout.image &&
      this.imageTextures.has(layout.image)
        ? 1
        : 0;
    bg.uniforms.image.value = layout.image
      ? this.imageTextures.get(layout.image)
      : null;
    const fade = e.effect
      ? e.effect.persist
        ? 1
        : 1 - clamp((e.progress - (1 - e.effect.fade)) / e.effect.fade)
      : 0;
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8),
        f = i % 8,
        dark = (r + f) % 2 === 0;
      const mat = this.squares[i].material as T.MeshBasicMaterial;
      mat.color.set(dark ? p.style.dark : p.style.light);
      if (dark) mat.color.lerp(new T.Color(p.pulse.color), e.pulse);
      const square = String.fromCharCode(97 + f) + (r + 1),
        highlight = this.highlights[i];
      highlight.visible = e.highlights.includes(square);
      if (e.effect) {
        const hm = highlight.material as T.MeshBasicMaterial;
        hm.color.set(
          square === e.from
            ? e.effect.sourceColor
            : square === e.to
              ? e.effect.destColor
              : e.effect.pathColor,
        );
        hm.opacity = e.effect.opacity * fade;
      }
    }
    for (const mesh of this.pieces.values()) mesh.visible = false;
    for (const mesh of this.shadows.values()) mesh.visible = false;
    for (const v of e.pieces) {
      const key = `${v.id}-${v.type}-${v.color}`;
      let mesh = this.pieces.get(key);
      if (!mesh) {
        mesh = pieceMesh(v.type, v.color);
        this.pieces.set(key, mesh);
        this.root.add(mesh);
      }
      mesh.visible = v.opacity > 0.001;
      mesh.position.set(v.x, v.y, 0.16 + v.z);
      mesh.rotation.set(v.rx, v.ry, v.rz + (sign < 0 ? Math.PI : 0));
      mesh.scale.setScalar(v.scale);
      for (const m of mesh.userData.materials as T.Material[]) {
        m.opacity = v.opacity;
        m.depthWrite = v.opacity > 0.99;
      }
      let shadow = this.shadows.get(v.id);
      if (!shadow) {
        shadow = new T.Mesh(
          new T.PlaneGeometry(1, 1),
          new T.MeshBasicMaterial({
            map: this.softTexture(),
            color: "#0b1f1a",
            transparent: true,
            depthWrite: false,
          }),
        );
        this.shadows.set(v.id, shadow);
        this.root.add(shadow);
      }
      shadow.visible = mesh.visible;
      shadow.position.set(v.x + 0.05, v.y - 0.08, 0.025);
      shadow.scale.set(1 + v.z * 0.4, 0.75 + v.z * 0.4, 1);
      (shadow.material as T.MeshBasicMaterial).opacity =
        (0.28 * v.opacity) / (1 + v.z);
    }
    this.glow.visible = e.glow > 0;
    if (e.effect && e.to) {
      const xy = squareXY(e.to);
      this.glow.position.set(xy[0], xy[1], 0.05);
      this.glow.scale.setScalar(e.effect.radius * 3);
      const m = this.glow.material as T.MeshBasicMaterial;
      m.color.set(e.effect.glowColor);
      m.opacity = clamp(e.glow * 0.8);
    }
    this.trail.visible = !!e.effect?.trail && e.trail.length > 1;
    if (this.trail.visible && e.effect) {
      const vertices: number[] = [];
      for (let i = 0; i < e.trail.length - 1; i++) {
        const a = e.trail[i],
          b = e.trail[i + 1],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          len = Math.hypot(dx, dy) || 1,
          half = e.effect.trailWidth / 2;
        const ax = a[0] - (dy / len) * half,
          ay = a[1] + (dx / len) * half,
          bx = a[0] + (dy / len) * half,
          by = a[1] - (dx / len) * half,
          cx = b[0] - (dy / len) * half,
          cy = b[1] + (dx / len) * half,
          dx2 = b[0] + (dy / len) * half,
          dy2 = b[1] - (dx / len) * half;
        vertices.push(
          ax,
          ay,
          0,
          bx,
          by,
          0,
          cx,
          cy,
          0,
          bx,
          by,
          0,
          dx2,
          dy2,
          0,
          cx,
          cy,
          0,
        );
      }
      this.trail.geometry.dispose();
      this.trail.geometry = new T.BufferGeometry();
      this.trail.geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(vertices, 3),
      );
      const m = this.trail.material as T.MeshBasicMaterial;
      m.color.set(e.effect.pathColor);
      m.opacity = e.effect.opacity * fade;
    }
    this.badge.visible = !!e.badge;
    this.badgeAura.visible = !!e.badge && !!e.effect?.badge.glow;
    this.ring.visible = !!e.badge && !!e.effect?.badge.ring;
    if (e.badge && e.badgeAt && e.effect) {
      const b = e.effect.badge,
        entry = clamp((e.progress - b.start) / 0.08),
        exit = clamp((b.end - e.progress) / 0.05);
      const imported = p.badgePack[e.badge],
        key = e.badge;
      if (!this.badgeTextures.has(key)) {
        const [label, color] = symbols[key] ?? [key, "#6f88bb"];
        this.badgeTextures.set(key, textTexture(label, "#ffffff", color));
      }
      const mat = this.badge.material as T.MeshBasicMaterial;
      mat.map = imported
        ? (this.imageTextures.get(imported) ?? this.badgeTextures.get(key)!)
        : this.badgeTextures.get(key)!;
      mat.opacity = b.opacity * entry * exit;
      mat.needsUpdate = true;
      this.badge.position.set(e.badgeAt[0], e.badgeAt[1], 1.8);
      this.badge.rotation.z = sign < 0 ? Math.PI : 0;
      this.badge.scale.setScalar(b.size * (0.7 + 0.3 * entry));
      this.badgeAura.position.copy(this.badge.position);
      this.badgeAura.scale.setScalar(b.size * (1 + b.glow));
      const aura = this.badgeAura.material as T.MeshBasicMaterial;
      aura.color.set(e.effect.glowColor);
      aura.opacity = clamp(b.glow * 0.4) * b.opacity * entry * exit;
      this.ring.position.copy(this.badge.position);
      this.ring.scale.setScalar(b.size * (1 + (1 - entry) * 2));
      const rm = this.ring.material as T.MeshBasicMaterial;
      rm.opacity = b.glow * entry * exit * 0.5;
      rm.color.set(e.effect.glowColor);
    }
    for (let layer = 0; layer < 2; layer++) {
      const snow = this.snow[layer],
        a = p.ambient;
      snow.visible =
        a.enabled &&
        (a.layer === "both" ||
          (layer === 0 ? a.layer === "behind" : a.layer === "over"));
      const attr = snow.geometry.attributes.position as T.BufferAttribute;
      const sizes = snow.geometry.attributes.particleSize as T.BufferAttribute,
        alphas = snow.geometry.attributes.particleAlpha as T.BufferAttribute;
      for (let i = 0; i < a.density; i++) {
        const v = particle(a.seed + layer * 479, i, time, a);
        attr.setXYZ(i, v.x, v.y, layer === 0 ? -1 - v.z : 2 + v.z);
        sizes.setX(i, v.size * (1 + v.z));
        alphas.setX(i, v.alpha * (a.layer === "both" ? 0.7 : 1));
      }
      attr.needsUpdate = true;
      sizes.needsUpdate = true;
      alphas.needsUpdate = true;
      snow.geometry.setDrawRange(0, Math.floor(a.density));
      const m = snow.material as T.ShaderMaterial;
      m.uniforms.color.value.set(a.color);
      m.uniforms.softness.value = Math.max(0.02, a.softness);
      m.uniforms.sizeScale.value = height / h;
    }
    this.impacts.visible = !!e.effect?.impactParticles && e.impact > 0;
    if (this.impacts.visible && e.to && e.effect) {
      const [x, y] = squareXY(e.to),
        progress = clamp((e.progress - e.effect.impact) / 0.22);
      const a = this.impacts.geometry.attributes.position as T.BufferAttribute;
      for (let i = 0; i < 24; i++) {
        const angle = i * 2.39996,
          rad = progress * (0.7 + (i % 5) * 0.12);
        a.setXYZ(
          i,
          x + Math.cos(angle) * rad,
          y + Math.sin(angle) * rad,
          0.3 + progress * 0.6,
        );
      }
      a.needsUpdate = true;
      const m = this.impacts.material as T.PointsMaterial;
      m.color.set(e.effect.glowColor);
      m.opacity = (1 - progress) * e.impact;
    }
    this.background.quaternion.copy(this.camera.quaternion);
    this.background.position
      .copy(this.camera.position)
      .addScaledVector(this.camera.getWorldDirection(new T.Vector3()), 25);
    this.background.scale.set(w / 120, h / 120, 1);
    this.pickCamera = null;
    this.squareViewport = null;
    if (squareIn) {
      const squareCamera = this.camera.clone(),
        size = Math.min(width, height),
        bottom = clamp(
          (height - size) / 2 + (layout.y * size) / 9.5,
          0,
          height - size,
        ),
        left = (width - size) / 2;
      this.squareViewport = { x: left, y: bottom, size };
      this.pickCamera = squareCamera;
      // The surrounding portrait canvas is rendered separately from the square stage.
      const fullCamera = new T.OrthographicCamera(
        -4.75,
        4.75,
        (4.75 * height) / width,
        (-4.75 * height) / width,
        0.1,
        100,
      );
      fullCamera.position.z = 20;
      fullCamera.updateMatrixWorld();
      this.background.quaternion.copy(fullCamera.quaternion);
      this.background.position.set(0, 0, -4);
      this.background.scale.set(9.5 / 120, (9.5 * height) / width / 120, 1);
      const snowVisibility = this.snow.map((s) => s.visible);
      this.root.visible = false;
      this.snow[1].visible = false;
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.autoClear = true;
      this.renderer.render(this.scene, fullCamera);
      this.root.visible = true;
      this.background.visible = false;
      this.atmosphere.visible = false;
      this.renderer.autoClear = false;
      this.renderer.setViewport(left, bottom, size, size);
      this.renderer.setScissor(left, bottom, size, size);
      this.renderer.setScissorTest(true);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, squareCamera);
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, width, height);
      this.root.visible = false;
      this.atmosphere.visible = true;
      this.snow[0].visible = false;
      this.snow[1].visible = snowVisibility[1];
      this.renderer.clearDepth();
      this.renderer.render(this.scene, fullCamera);
      this.root.visible = true;
      this.background.visible = true;
      this.snow.forEach((s, i) => (s.visible = snowVisibility[i]));
      this.renderer.autoClear = true;
    } else {
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.render(this.scene, this.camera);
    }
    return e;
  }
  pick(clientX: number, clientY: number): string | null {
    const rect = this.canvas.getBoundingClientRect(),
      ray = new T.Raycaster();
    let x = (clientX - rect.left) / rect.width,
      y = 1 - (clientY - rect.top) / rect.height;
    if (this.squareViewport) {
      const v = this.squareViewport;
      x = (x * this.w - v.x) / v.size;
      y = (y * this.h - v.y) / v.size;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    }
    ray.setFromCamera(
      new T.Vector2(x * 2 - 1, y * 2 - 1),
      this.pickCamera ?? this.camera,
    );
    const hit = ray.intersectObjects(this.squares)[0];
    if (!hit) return null;
    const i = this.squares.indexOf(hit.object as T.Mesh);
    return String.fromCharCode(97 + (i % 8)) + (Math.floor(i / 8) + 1);
  }
  rgba(): Uint8Array {
    // WebGL's default framebuffer is bottom-up. FFmpeg gets top-down RGBA.
    const gl = this.renderer.getContext(),
      raw = new Uint8Array(this.w * this.h * 4),
      out = new Uint8Array(raw.length);
    gl.readPixels(0, 0, this.w, this.h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const stride = this.w * 4;
    for (let y = 0; y < this.h; y++)
      out.set(
        raw.subarray((this.h - y - 1) * stride, (this.h - y) * stride),
        y * stride,
      );
    return out;
  }
  get lastEvaluation() {
    return this.evaluation;
  }
  dispose() {
    this.scene.traverse((o) => {
      const m = o as T.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material)
        for (const mat of Array.isArray(m.material)
          ? m.material
          : [m.material]) {
          const tex = (mat as T.MeshBasicMaterial).map;
          tex?.dispose();
          mat.dispose();
        }
    });
    this.renderer.dispose();
  }
}
