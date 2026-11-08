import * as T from "three";
/** Copies completed default-framebuffer images; existing graph passes retain their
 * framebuffer assumptions. Two textures are reused only while blending. Raw sRGB
 * captures are decoded before blending and encoded exactly once afterward. */
export class TransitionSystem {
  private width = 0;
  private height = 0;
  private frames: T.FramebufferTexture[] = [];
  private scene = new T.Scene();
  private camera = new T.Camera();
  private material = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      previous: { value: null },
      next: { value: null },
      outgoing: { value: 1 },
      incoming: { value: 0 },
    },
    vertexShader:
      "varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `varying vec2 uv0;uniform sampler2D previous,next;uniform float outgoing,incoming;
      vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
      vec3 encode(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
      void main(){vec3 c=linearize(texture2D(previous,uv0).rgb)*outgoing+linearize(texture2D(next,uv0).rgb)*incoming;gl_FragColor=vec4(encode(c),1.);}`,
  });
  private quad = new T.Mesh(new T.PlaneGeometry(2, 2), this.material);
  constructor(private renderer: T.WebGLRenderer) {
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }
  capture(index: number, w: number, h: number) {
    if (this.width !== w || this.height !== h) {
      this.release();
      this.width = w;
      this.height = h;
      this.frames = [
        new T.FramebufferTexture(w, h),
        new T.FramebufferTexture(w, h),
      ];
    }
    this.renderer.copyFramebufferToTexture(this.frames[index]);
  }
  blend(outgoing: number, incoming: number) {
    const u = this.material.uniforms;
    u.previous.value = this.frames[0];
    u.next.value = this.frames[1];
    u.outgoing.value = outgoing;
    u.incoming.value = incoming;
    this.renderer.setRenderTarget(null);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.setScissorTest(false);
    this.renderer.render(this.scene, this.camera);
  }
  private release() {
    for (const t of this.frames) t.dispose();
    this.frames = [];
  }
  dispose() {
    this.release();
    this.quad.geometry.dispose();
    this.material.dispose();
    this.scene.clear();
  }
}
