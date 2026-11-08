import { compileStoryboard } from "../core/storyboard";
import { evaluatePresentationFrame } from "./engine/presentation";
import { AnnotationSystem } from "./systems/AnnotationSystem";
import * as T from "three";
import { CinematicCaptureSystem } from "./systems/CinematicCaptureSystem";
import { BloomSystem } from "./systems/BloomSystem";
import { worldToSquare } from "./engine/coordinates";
import type { Project, Format, PlaybackMode } from "../core/project";
import { buildGame, type Game } from "../core/chess";
import { evaluateRenderFrame, type RenderFrame } from "./engine/frame";
import { RenderGraph, type Pass } from "./engine/RenderGraph";
import { BackgroundSystem } from "./systems/BackgroundSystem";
import { CameraSystem } from "./systems/CameraSystem";
import { BoardSystem } from "./systems/BoardSystem";
import { PieceSystem } from "./systems/PieceSystem";
import { MotionSystem } from "./systems/MotionSystem";
import { CaptureSystem } from "./systems/CaptureSystem";
import { LightingSystem } from "./systems/LightingSystem";
import { AtmosphereSystem } from "./systems/AtmosphereSystem";
import { SpotlightSystem } from "./systems/SpotlightSystem";
import { OverlaySystem } from "./systems/OverlaySystem";
import { Assets, type AssetRetry } from "./engine/Assets";
import type { ResourceKey } from "./engine/RuntimeResources";
export class ContextLostError extends Error {
  constructor() {
    super(
      "Graphics context was lost. Reload graphics to continue; your project is preserved.",
    );
  }
}
export interface RenderServices {
  invalidateResource: (key?: ResourceKey<unknown>) => void;
  invalidate: () => void;
  renderer: T.WebGLRenderer;
  camera: T.OrthographicCamera;
  world: T.Scene;
  root: T.Group;
  assets: ReadonlyMap<string, T.Texture>;
}
export type SceneExtensions =
  | readonly Pass<RenderFrame>[]
  | ((services: RenderServices) => readonly Pass<RenderFrame>[]);
/** Public preview/export facade. Every visual update belongs to a graph system. */
export class Scene {
  readonly renderer: T.WebGLRenderer;
  readonly ready: Promise<void>;
  private world = new T.Scene();
  private root = new T.Group();
  private assets = new Map<string, T.Texture>();
  private assetStore = new Assets(
    this.assets,
    async (url) => {
      const texture = await new T.TextureLoader().loadAsync(url);
      texture.colorSpace = T.SRGBColorSpace;
      return texture;
    },
    () => this.invalidate(),
  );
  private graph: RenderGraph<RenderFrame>;
  private cameras: CameraSystem;
  private board: BoardSystem;
  private annotations: AnnotationSystem;
  private project?: Project;
  private game?: Game;
  private current?: RenderFrame;
  private dead = false;
  private contextLost = false;
  private lost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    this.renderedRevision = -1;
  };
  private revision = 0;
  private renderedRevision = -1;
  private width = 1;
  private height = 1;
  private readback = new Uint8Array(0);
  constructor(canvas: HTMLCanvasElement, extensions: SceneExtensions = []) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      stencil: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    canvas.addEventListener("webglcontextlost", this.lost);
    const r = this.renderer;
    r.setPixelRatio(1);
    r.outputColorSpace = T.SRGBColorSpace;
    r.autoClear = false;
    r.setClearColor("#111918");
    this.world.add(this.root);
    this.cameras = new CameraSystem(this.root);
    const camera = this.cameras.camera;
    const lighting = new LightingSystem(this.world);
    const spotlight = new SpotlightSystem(this.root, r, camera);
    const background = new BackgroundSystem(r, this.assets);
    this.board = new BoardSystem(this.root);
    const motion = new MotionSystem(this.root);
    const annotations = (this.annotations = new AnnotationSystem(this.root, r));
    const overlay = new OverlaySystem(this.root, r, this.assets);
    const atmosphere = new AtmosphereSystem(this.world, camera);
    const pieces = new PieceSystem(this.root);
    const capture = new CaptureSystem(this.root, camera, pieces.meshes);
    const cinematic = new CinematicCaptureSystem(
      this.root,
      camera,
      pieces.meshes,
    );
    const bloom = new BloomSystem(r, this.world, camera);
    const systems = [
      annotations,
      bloom,
      cinematic,
      capture,
      pieces,
      atmosphere,
      overlay,
      motion,
      this.board,
      background,
      spotlight,
      lighting,
    ];
    // Constructor rollback and graph ownership share these once-only callbacks.
    for (const system of systems) {
      const dispose = system.dispose.bind(system);
      let released = false;
      system.dispose = () => {
        if (!released) {
          released = true;
          dispose();
        }
      };
    }
    this.ready = pieces.ready.then(() => {
      this.revision++;
    });
    try {
      const extraPasses =
        typeof extensions === "function"
          ? extensions({
              invalidateResource: (key) => this.invalidateResource(key),
              invalidate: () => this.invalidate(),
              renderer: r,
              camera,
              world: this.world,
              root: this.root,
              assets: this.assets,
            })
          : extensions;
      if (extraPasses.some((pass) => pass.stage === "world"))
        throw Error(
          "The world stage is reserved for the scene draw; use board for world effects or post for screen effects",
        );
      this.graph = new RenderGraph<RenderFrame>([
        {
          id: "background",
          stage: "background",
          outputs: ["background"],
          render: (c) => background.update(c),
          dispose: () => background.dispose(),
        },
        {
          id: "camera",
          stage: "board",
          outputs: ["camera"],
          render: (c) => this.cameras.update(c),
        },
        {
          id: "board",
          stage: "board",
          inputs: ["camera"],
          outputs: ["board"],
          render: (c) => this.board.update(c),
          dispose: () => this.board.dispose(),
        },
        {
          id: "motion",
          stage: "board",
          inputs: ["board"],
          outputs: ["motion"],
          render: (c) => motion.update(c),
          dispose: () => motion.dispose(),
        },
        {
          id: "pieces",
          stage: "board",
          inputs: ["motion"],
          outputs: ["pieces"],
          render: (c) => pieces.update(c),
          dispose: () => pieces.dispose(),
        },
        {
          id: "capture",
          stage: "board",
          inputs: ["pieces"],
          render: (c) => capture.update(c),
          dispose: () => capture.dispose(),
        },
        {
          id: "cinematic-captures",
          stage: "board",
          after: ["capture"],
          render: (c) => cinematic.update(c),
          dispose: () => cinematic.dispose(),
        },
        {
          id: "atmosphere",
          stage: "board",
          inputs: ["camera"],
          render: (c) => atmosphere.update(c),
          dispose: () => atmosphere.dispose(),
        },
        {
          id: "spotlight",
          stage: "board",
          inputs: ["board"],
          render: (c) => spotlight.update(c),
          dispose: () => spotlight.dispose(),
        },
        {
          id: "lighting",
          stage: "board",
          render: (c) => lighting.update(c),
          dispose: () => lighting.dispose(),
        },
        {
          id: "badges",
          stage: "board",
          inputs: ["pieces"],
          render: (c) => overlay.update(c),
          dispose: () => overlay.dispose(),
        },
        {
          id: "annotations",
          stage: "board",
          render: (c) => annotations.update(c),
          dispose: () => annotations.dispose(),
        },
        {
          id: "world",
          stage: "world",
          after: [
            "cinematic-captures",
            "capture",
            "atmosphere",
            "spotlight",
            "lighting",
            "badges",
            "annotations",
          ],
          outputs: ["scene-color"],
          render: (c) => {
            if (c.titleCard) return;
            if (c.square || c.short) {
              this.root.visible = false;
              lighting.moveLight.visible = false;
              r.clearDepth();
              if (!c.short) r.render(this.world, camera);
              this.root.visible = true;
              lighting.moveLight.visible = c.e.light.strength > 0.0001;
              r.setViewport(0, c.viewY, c.w, c.viewH);
              r.setScissor(0, c.viewY, c.w, c.viewH);
              r.setScissorTest(true);
            }
            r.clearDepth();
            r.render(this.world, camera);
            r.setScissorTest(false);
          },
        },
        {
          id: "spotlight-post",
          stage: "post",
          inputs: ["scene-color"],
          active: (c) => !!c.e.jam && c.e.jam.envelope > 0.001,
          render: (c) => spotlight.post(c),
        },
        {
          id: "cinematic-bloom",
          stage: "post",
          after: ["spotlight-post"],
          render: (c) => {
            if (!c.titleCard) bloom.render(c);
          },
          dispose: () => bloom.dispose(),
        },
        {
          id: "information-overlay",
          stage: "overlay",
          inputs: ["scene-color"],
          active: (c) =>
            c.p.evalBar || (c.p.introTitle.enabled && c.time < c.p.lead),
          render: (c) => overlay.post(c),
        },
        {
          id: "annotation-text",
          stage: "overlay",
          after: ["information-overlay"],
          render: (c) => annotations.post(c),
        },
        ...extraPasses,
      ]);
    } catch (error) {
      const errors: unknown[] = [];
      for (const system of systems)
        try {
          system.dispose();
        } catch (e) {
          errors.push(e);
        }
      for (const cleanup of [
        () => this.world.clear(),
        () => r.dispose(),
        () => r.forceContextLoss(),
      ])
        try {
          cleanup();
        } catch (e) {
          errors.push(e);
        }
      canvas.removeEventListener("webglcontextlost", this.lost);
      void this.ready.catch(() => {});
      if (errors.length)
        throw new AggregateError(
          [error, ...errors],
          "Scene initialization and cleanup failed",
          { cause: error },
        );
      throw error;
    }
  }
  private assertLive() {
    if (this.dead) throw Error("Scene is disposed");
  }
  /** Call after changing extension state outside the immutable project. */
  invalidate() {
    this.assertLive();
    this.revision++;
  }
  invalidateResource(key?: ResourceKey<unknown>) {
    this.assertLive();
    try {
      this.graph.invalidateResource(key);
    } finally {
      this.invalidate();
    }
  }
  assetState(id: string) {
    return this.assetStore.state(id);
  }
  setAsset(id: string, url: string, retry?: AssetRetry) {
    this.assertLive();
    return this.assetStore.set(id, url, retry);
  }
  prepareAssets(urls: Record<string, string>) {
    this.assertLive();
    return this.assetStore.prepare(urls);
  }
  removeAsset(id: string) {
    this.assertLive();
    this.assetStore.remove(id);
  }
  private assertGraphics() {
    this.assertLive();
    if (this.contextLost || this.renderer.getContext().isContextLost())
      throw new ContextLostError();
  }
  render(
    p: Project,
    time: number,
    w: number,
    h: number,
    format: Format = p.format,
    mode: PlaybackMode = "source",
  ) {
    this.assertGraphics();
    const previous = this.current;
    if (
      previous &&
      previous.authoring === p &&
      previous.mode === mode &&
      previous.outputTime === time &&
      previous.w === w &&
      previous.h === h &&
      previous.format === format &&
      this.renderedRevision === this.revision
    )
      return previous.e;
    const frameRevision = this.revision;
    // A failed frame must never be mistaken for a cached successful draw.
    this.renderedRevision = -1;
    if (this.project !== p) {
      this.game =
        mode === "storyboard" ? compileStoryboard(p).game : buildGame(p);
      this.project = p;
    }
    if (
      w > this.renderer.capabilities.maxTextureSize ||
      h > this.renderer.capabilities.maxTextureSize
    )
      throw RangeError("Render dimensions exceed GPU capabilities");
    const c = evaluatePresentationFrame(p, time, w, h, format, mode, this.game);
    const r = this.renderer;
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      r.setSize(w, h, false);
    }
    const viewport = r.getViewport(new T.Vector4()),
      scissor = r.getScissor(new T.Vector4());
    const scissorTest = r.getScissorTest(),
      target = r.getRenderTarget();
    const face = r.getActiveCubeFace(),
      mip = r.getActiveMipmapLevel();
    const color = r.getClearColor(new T.Color()),
      alpha = r.getClearAlpha();
    const autoClear = r.autoClear,
      visible = this.root.visible;
    const toneMapping = r.toneMapping,
      exposure = r.toneMappingExposure,
      colorSpace = r.outputColorSpace;
    try {
      r.setRenderTarget(null);
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      r.setClearColor(c.short ? p.shorts.barColor : "#111918");
      r.clear(true, true, true);
      this.graph.render(time, c, w, h, c.p);
    } finally {
      this.root.visible = visible;
      r.resetState();
      r.setRenderTarget(target, face, mip);
      r.setViewport(viewport);
      r.setScissor(scissor);
      r.setScissorTest(scissorTest);
      r.setClearColor(color, alpha);
      r.autoClear = autoClear;
      r.toneMapping = toneMapping;
      r.toneMappingExposure = exposure;
      r.outputColorSpace = colorSpace;
    }
    this.assertGraphics();
    this.current = c;
    this.renderedRevision = frameRevision;
    return c.e;
  }
  textGeometry() {
    return this.annotations.bounds.map((b) => ({
      id: b.id,
      left: b.left / this.width,
      top: b.top / this.height,
      right: b.right / this.width,
      bottom: b.bottom / this.height,
    }));
  }
  pickAnnotation(clientX: number, clientY: number) {
    this.assertLive();
    const c = this.current,
      rect = this.renderer.domElement.getBoundingClientRect();
    if (
      !c ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    )
      return null;
    const px = ((clientX - rect.left) / rect.width) * c.w,
      py = ((clientY - rect.top) / rect.height) * c.h;
    this.root.updateWorldMatrix(true, true);
    this.cameras.camera.updateMatrixWorld(true);
    const boardY = c.h - py;
    let ray: T.Raycaster | undefined;
    if (boardY >= c.viewY && boardY <= c.viewY + c.viewH) {
      ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          (px / c.w) * 2 - 1,
          ((boardY - c.viewY) / c.viewH) * 2 - 1,
        ),
        this.cameras.camera,
      );
    }
    return this.annotations.pick(px, py, ray);
  }
  pick(clientX: number, clientY: number) {
    this.assertLive();
    const c = this.current;
    if (!c || c.titleCard) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    )
      return null;
    const px = ((clientX - rect.left) / rect.width) * c.w,
      py = (1 - (clientY - rect.top) / rect.height) * c.h;
    if (py < c.viewY || py > c.viewY + c.viewH) return null;
    this.root.updateWorldMatrix(true, true);
    this.cameras.camera.updateMatrixWorld(true);
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2((px / c.w) * 2 - 1, ((py - c.viewY) / c.viewH) * 2 - 1),
      this.cameras.camera,
    );
    // Pick the board's geometric plane rather than render meshes, whose
    // material/layer state can change during compositor passes.
    const normal = new T.Vector3(0, 0, 1).applyNormalMatrix(
      new T.Matrix3().getNormalMatrix(this.root.matrixWorld),
    );
    const origin = this.root.localToWorld(new T.Vector3());
    const plane = new T.Plane().setFromNormalAndCoplanarPoint(normal, origin);
    const hit = ray.ray.intersectPlane(plane, new T.Vector3());
    if (!hit) return null;
    const point = this.root.worldToLocal(hit);
    return worldToSquare(point.x, point.y);
  }
  rgba() {
    this.assertGraphics();
    const gl = this.renderer.getContext();
    const bytes = this.width * this.height * 4;
    if (this.readback.length !== bytes) this.readback = new Uint8Array(bytes);
    const raw = this.readback,
      out = new Uint8Array(bytes);
    const target = this.renderer.getRenderTarget(),
      face = this.renderer.getActiveCubeFace(),
      mip = this.renderer.getActiveMipmapLevel();
    try {
      this.renderer.setRenderTarget(null);
      gl.readPixels(
        0,
        0,
        this.width,
        this.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        raw,
      );
    } finally {
      this.renderer.setRenderTarget(target, face, mip);
    }

    for (let y = 0; y < this.height; y++)
      out.set(
        raw.subarray(y * this.width * 4, (y + 1) * this.width * 4),
        (this.height - y - 1) * this.width * 4,
      );
    return out;
  }
  dispose() {
    if (this.dead) return;
    this.dead = true;
    this.renderer.domElement.removeEventListener("webglcontextlost", this.lost);
    this.readback = new Uint8Array(0);
    const errors: unknown[] = [];
    for (const cleanup of [
      () => this.graph.dispose(),
      () => this.assetStore.dispose(),
      () => this.world.clear(),
      () => this.renderer.dispose(),
      () => this.renderer.forceContextLoss(),
    ])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, "Scene cleanup failed");
  }
}
