import * as T from 'three';
/** A scope owns local GPU objects; borrowed artwork and asset maps are excluded. */
export class Resources {
  private items=new Set<{dispose():void}>();
  own<R extends {dispose():void}>(resource:R):R {this.items.add(resource);return resource;}
  tree(root:T.Object3D, textures=false) {
    root.traverse(object=>{
      if(object instanceof T.Mesh || object instanceof T.Points || object instanceof T.Sprite) {
        if('geometry' in object) this.own(object.geometry);
        for(const material of Array.isArray(object.material)?object.material:[object.material]) {
          this.own(material);
          if(textures) for(const value of Object.values(material)) if(value instanceof T.Texture) this.own(value);
        }
      }
    });
  }
  dispose(){for(const resource of this.items) resource.dispose();this.items.clear();}
}
export function radialTexture() {
  const c=document.createElement('canvas');c.width=c.height=128;
  const x=c.getContext('2d')!, g=x.createRadialGradient(64,64,1,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,.8)');g.addColorStop(.4,'rgba(255,255,255,.25)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c);
}
export function makePoints(count:number) {
  const geometry=new T.BufferGeometry();
  for(const [name,size] of [['position',3],['alpha',1],['size',1]] as const)
    geometry.setAttribute(name,new T.Float32BufferAttribute(new Float32Array(count*size),size));
  return new T.Points(geometry,new T.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{color:{value:new T.Color('#ffffff')},softness:{value:.5},pixels:{value:70}},
    vertexShader:'attribute float alpha;attribute float size;varying float a;uniform float pixels;void main(){a=alpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,size*pixels);}',
    fragmentShader:'uniform vec3 color;uniform float softness;varying float a;void main(){float d=length(gl_PointCoord-.5)*2.;gl_FragColor=vec4(color,a*(1.-smoothstep(1.-softness,1.,d)));}'
  }));
}
