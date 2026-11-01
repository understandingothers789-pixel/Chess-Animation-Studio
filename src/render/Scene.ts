import * as T from "three";
import { worldToSquare } from "./engine/coordinates";
import type { Project, Format } from "../core/project";
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
export interface RenderServices {
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
  private requests = new Map<string, symbol>();
  private graph: RenderGraph<RenderFrame>;
  private cameras: CameraSystem;
  private board: BoardSystem;
  private project?: Project;
  private game?: Game;
  private current?: RenderFrame;
  private dead = false;
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
    const overlay = new OverlaySystem(this.root, r, this.assets);
    const atmosphere = new AtmosphereSystem(this.world, camera);
    const pieces = new PieceSystem(this.root);
    const capture = new CaptureSystem(this.root, camera, pieces.meshes);
    this.ready = pieces.ready.then(() => {
      this.revision++;
    });
    try {
      const extraPasses =
        typeof extensions === "function"
          ? extensions({
              renderer: r,
              camera,
              world: this.world,
              root: this.root,
              assets: this.assets,
            })
          : extensions;
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
          id: "world",
          stage: "board",
          after: ["capture", "atmosphere", "spotlight", "lighting", "badges"],
          outputs: ["scene-color"],
          render: (c) => {
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
          id: "information-overlay",
          stage: "overlay",
          inputs: ["scene-color"],
          active: (c) =>
            c.p.evalBar || (c.p.introTitle.enabled && c.time < c.p.lead),
          render: (c) => overlay.post(c),
        },
        ...extraPasses,
      ]);
    } catch (error) {
      // Graph validation can fail before graph ownership begins.
      for (const system of [
        capture,
        pieces,
        atmosphere,
        overlay,
        motion,
        this.board,
        background,
        spotlight,
        lighting,
      ])
        system.dispose();
      this.world.clear();
      r.dispose();
      r.forceContextLoss();
      void this.ready.catch(() => {}); // The constructor error is the observable failure.
      throw error;
    }
  }
  private assertLive() {
    if (this.dead) throw Error("Scene is disposed");
  }
  async setAsset(id: string, url: string) {
    this.assertLive();
    const request = Symbol(id);
    this.requests.set(id, request);
    const texture = await new T.TextureLoader().loadAsync(url);
    texture.colorSpace = T.SRGBColorSpace;
    if (this.dead || this.requests.get(id) !== request) {
      texture.dispose();
      return;
    }
    this.assets.get(id)?.dispose();
    this.assets.set(id, texture);
    this.revision++;
  }
  removeAsset(id: string) {
    this.assertLive();
    this.requests.delete(id);
    this.assets.get(id)?.dispose();
    this.assets.delete(id);
    this.revision++;
  }
  render(
    p: Project,
    time: number,
    w: number,
    h: number,
    format: Format = p.format,
  ) {
    this.assertLive();
    const previous = this.current;
    if (
      previous &&
      previous.p === p &&
      previous.time === time &&
      previous.w === w &&
      previous.h === h &&
      previous.format === format &&
      this.renderedRevision === this.revision
    )
      return previous.e;
    // A failed frame must never be mistaken for a cached successful draw.
    this.renderedRevision = -1;
    if (this.project !== p) {
      this.game = buildGame(p);
      this.project = p;
    }
    if (
      w > this.renderer.capabilities.maxTextureSize ||
      h > this.renderer.capabilities.maxTextureSize
    )
      throw RangeError("Render dimensions exceed GPU capabilities");
    const c = evaluateRenderFrame(p, time, w, h, format, this.game);
    const r = this.renderer;
    if (w !== this.width || h !== this.height) {
      this.width = w;
      this.height = h;
      r.setSize(w, h, false);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.setClearColor(c.short ? p.shorts.barColor : "#111918");
    r.clear(true, true, true);
    try {
      this.graph.render(time, c, w, h);
    } finally {
      this.root.visible = true;
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
    }
    this.current = c;
    this.renderedRevision = this.revision;
    return c.e;
  }
  pick(clientX: number, clientY: number) {
    this.assertLive();
    const c = this.current;
    if (!c) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * c.w,
      py = (1 - (clientY - rect.top) / rect.height) * c.h;
    if (py < c.viewY || py > c.viewY + c.viewH) return null;
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2((px / c.w) * 2 - 1, ((py - c.viewY) / c.viewH) * 2 - 1),
      this.cameras.camera,
    );
    const hit = ray.intersectObjects(this.board.squares)[0];
    if (!hit) return null;
    const point = this.root.worldToLocal(hit.point.clone());
    return worldToSquare(point.x, point.y);
  }
  rgba() {
    this.assertLive();
    const gl = this.renderer.getContext();
    const bytes = this.width * this.height * 4;
    if (this.readback.length !== bytes) this.readback = new Uint8Array(bytes);
    const raw = this.readback,
      out = new Uint8Array(bytes);
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
    if (this.dead) return;
    this.dead = true;
    this.requests.clear();
    this.readback = new Uint8Array(0);
    try {
      this.graph.dispose();
    } finally {
      for (const texture of this.assets.values()) texture.dispose();
      this.assets.clear();
      this.world.clear();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
  }
}
