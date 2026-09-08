// Galactic passage: real, two-sided copies and one streak batch over a stellar sky.
// Shaders animate geometry in depth; no per-copy textures or frame-loop allocation.
export function createSingularity(THREE,{scene,atlas,backAtlas,columns,rows,records,mobile}) {
  const group=new THREE.Group();scene.add(group);group.visible=false;
  const uniforms={
    uTime:{value:0},uFlow:{value:0},uSpeed:{value:0},uField:{value:1},
    uColor:{value:new THREE.Color('#73cfff')},uEcho:{value:new THREE.Color('#e69b63')},
    uCross:{value:0},uReveal:{value:0},uAspect:{value:1}
  };
  const materials=[],geometries=[];
  function material(options){const m=new THREE.ShaderMaterial({uniforms:{...uniforms},transparent:true,depthWrite:false,toneMapped:false,...options});materials.push(m);return m;}
  const plane=new THREE.PlaneGeometry(1,1);geometries.push(plane);
  const seed=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);};
  function instances(count){
    const g=new THREE.InstancedBufferGeometry();g.index=plane.index;g.attributes.position=plane.attributes.position;g.attributes.uv=plane.attributes.uv;
    const seeds=new Float32Array(count*4);for(let i=0;i<count;i++)seeds.set([seed(i*4),seed(i*4+1),seed(i*4+2),seed(i*4+3)],i*4);
    g.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));g.instanceCount=count;geometries.push(g);return g;
  }

  // A continuous Milky Way band, with irregular dust extinction and pinprick stars.
  // Screen-space keeps the sky behind every copy without an opaque central object.
  const sky=new THREE.Mesh(plane,material({depthTest:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy*2.,.999,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime,uAspect,uSpeed,uCross,uReveal;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      float fbm(vec2 p){float n=0.,amp=.5;for(int i=0;i<5;i++){n+=amp*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(7.1,3.7);amp*=.5;}return n;}
      float starLayer(vec2 p,float scale,float threshold){vec2 cell=floor(p*scale),f=fract(p*scale);
        vec2 center=.15+.7*vec2(hash(cell),hash(cell+19.3));float size=.035+.065*hash(cell+5.2);
        vec2 d=f-center;return exp(-dot(d,d)/(size*size))*step(threshold,hash(cell+41.7));}
      void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);
        p*=.94+uSpeed*.035;p+=vec2(uTime*.0007,sin(uTime*.006)*.009);
        vec2 q=mat2(.91,-.415,.415,.91)*p;
        float cloud=fbm(q*4.+vec2(13.,7.));
        float spine=q.y+.045*sin(q.x*2.6)+(cloud-.5)*.13;
        float halo=exp(-spine*spine*10.);
        float band=exp(-spine*spine*70.);
        float coreX=(q.x-.16)*1.45;
        float core=exp(-coreX*coreX);
        float detail=fbm(q*25.+cloud*2.);
        float dust=fbm(q*11.+vec2(4.,12.));
        float laneY=(spine+.026+(dust-.5)*.16)*24.;
        float lane=exp(-laneY*laneY);
        float extinction=1.-lane*smoothstep(.27,.65,dust)*.94;
        vec3 cool=vec3(.16,.22,.36),pearl=vec3(.62,.55,.45);
        vec3 color=vec3(.003,.006,.014)+cool*halo*.10;
        color+=mix(cool,pearl,core*.82)*band*(.18+detail*.48)*extinction;
        color+=vec3(.19,.10,.20)*halo*pow(cloud,3.)*.34;
        color+=vec3(.60,.72,1.)*starLayer(p,95.,.955)*.56;
        color+=vec3(.90,.88,.81)*starLayer(p+17.,210.,mix(.992,.69,band*extinction))*.64;
        color+=vec3(.56,.65,.85)*starLayer(p-8.,390.,mix(.998,.78,band*extinction))*.38;
        float crossing=sin(uCross*3.14159)*(1.-uReveal);
        color*=1.-crossing*.65;gl_FragColor=vec4(color,1.);}`
  }));sky.frustumCulled=false;sky.renderOrder=-10;group.add(sky);

  const tunnel=new THREE.Group();group.add(tunnel);
  const starCount=mobile?650:1500,starGeo=instances(starCount);
  const stars=new THREE.Mesh(starGeo,material({blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`attribute vec4 aSeed;uniform float uFlow,uSpeed,uField,uAspect;varying vec2 vUv;varying float vFade,vTint;
      void main(){float a=aSeed.x*6.283185;float r=4.+pow(aSeed.y,.6)*75.;
        float z=-2.-mod(aSeed.z*230.-uFlow+10000.,230.);
        vec3 center=vec3(cos(a)*r,sin(a)*r,z);
        float length=.25+uSpeed*(15.+aSeed.w*35.);
        vec4 head=projectionMatrix*modelViewMatrix*vec4(center,1.);
        vec4 tail=projectionMatrix*modelViewMatrix*vec4(center-vec3(0.,0.,length),1.);
        vec2 dir=normalize(head.xy/head.w-tail.xy/tail.w+vec2(.00001));
        vec2 normal=vec2(-dir.y/uAspect,dir.x);
        vec4 clip=mix(head,tail,uv.y);
        clip.xy+=normal*position.x*(.0011+aSeed.w*.0012)*clip.w;
        gl_Position=clip;
        vUv=uv;vFade=(1.-smoothstep(110.,230.,-z))*smoothstep(0.,7.,-z)*(.25+.75*uField);vTint=aSeed.w;}`,
    fragmentShader:`varying vec2 vUv;varying float vFade,vTint;uniform vec3 uColor;
      void main(){float rim=pow(max(0.,1.-abs(vUv.x-.5)*2.),1.5);
        float tip=pow(sin(vUv.y*3.14159),.65);
        vec3 color=mix(vec3(.4,.72,1.),mix(uColor,vec3(.9,.97,1.),.65),vTint);
        gl_FragColor=vec4(color*(1.+rim),rim*tip*vFade*.8);}`
  }));stars.frustumCulled=false;tunnel.add(stars);

  const copyCount=mobile?44:96,copyGeo=instances(copyCount),cells=new Float32Array(copyCount*2);
  copyGeo.setAttribute('aCell',new THREE.InstancedBufferAttribute(cells,2));
  const copyUniforms={...uniforms,uAtlas:{value:atlas},uBack:{value:backAtlas},uGrid:{value:new THREE.Vector2(columns,rows)},uNarrow:{value:mobile?1:0}};
  const copies=new THREE.Mesh(copyGeo,material({uniforms:copyUniforms,side:THREE.DoubleSide,
    vertexShader:`attribute vec4 aSeed;attribute vec2 aCell;uniform float uFlow,uTime,uSpeed,uNarrow;varying vec2 vUv,vCell;varying float vFade;
      void main(){float a=aSeed.x*6.283185+uTime*.018;
        float radius=mix(10.,7.,uNarrow)+aSeed.y*15.;
        float z=-3.-mod(aSeed.z*190.-uFlow*.84+10000.,190.);
        float size=3.3+aSeed.w*2.8;
        float roll=(aSeed.x-.5)*1.2+uTime*(aSeed.w-.5)*.055;
        float turn=(aSeed.y-.5)*2.+sin(uTime*.17+aSeed.z*17.)*.45;
        if(aSeed.w>.73)turn+=3.14159;
        vec2 q=mat2(cos(roll),-sin(roll),sin(roll),cos(roll))*vec2(position.x,position.y*1.578)*size;
        vec3 p=vec3(cos(a)*radius,sin(a)*radius*.82,z)+vec3(q.x*cos(turn),q.y,q.x*sin(turn));
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        vUv=uv;vCell=aCell;vFade=(1.-smoothstep(80.,190.,-z))*smoothstep(1.,10.,-z);}`,
    fragmentShader:`varying vec2 vUv,vCell;varying float vFade;uniform sampler2D uAtlas,uBack;uniform vec2 uGrid;uniform float uField;uniform vec3 uColor;
      void main(){vec2 sideUv=gl_FrontFacing?vUv:vec2(1.-vUv.x,vUv.y);
        vec2 at=(vCell+clamp(sideUv,.008,.992))/uGrid;
        vec3 art=gl_FrontFacing?texture2D(uAtlas,at).rgb:texture2D(uBack,at).rgb;
        float edge=1.-smoothstep(.003,.016,min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y)));
        gl_FragColor=vec4(art*(.68+.32*uField)+uColor*edge*.55,vFade*uField);}`
  }));copies.frustumCulled=false;copies.renderOrder=1;tunnel.add(copies);

  // A soft chromatic shock front masks the crossing without a white-screen flash.
  const shock=new THREE.Mesh(plane,material({depthTest:false,blending:THREE.AdditiveBlending,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy*2.,0.,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uCross,uAspect,uReveal;uniform vec3 uColor;
      void main(){vec2 p=(vUv-.5)*vec2(uAspect,1.);float r=length(p);
        float wave=exp(-abs(r-uCross*2.)*16.)*sin(uCross*3.14159);
        float rim=pow(smoothstep(.15,1.,r),3.)*(1.-uReveal)*sin(uCross*3.14159);
        gl_FragColor=vec4(mix(uColor,vec3(.5,.8,1.),.55),wave*.48+rim*.13);}`
  }));shock.frustumCulled=false;shock.renderOrder=5;group.add(shock);

  const tint=new THREE.Color(),restPosition=new THREE.Vector3(),restScale=new THREE.Vector3();
  let previous=-1,queueIndex=-1,queueReference=null,flow=0;
  return {
    update({active,time,dt,frame,index,indices,quiet,playing,hero,camera,aspect,ambient}){
      group.visible=active;if(!active)return;
      uniforms.uTime.value=time;uniforms.uAspect.value=aspect;
      uniforms.uSpeed.value=quiet?0:frame.speed;
      uniforms.uCross.value=frame.crossing;uniforms.uReveal.value=frame.assemble;
      uniforms.uField.value=quiet?.12:frame.stage==='flight'?1:frame.stage==='crossing'?1-frame.crossing*.9:.12+frame.departure*.5;
      if(playing&&!quiet)flow+=dt*(3+frame.speed*100);
      uniforms.uFlow.value=flow;tunnel.position.copy(camera.position);
      if(previous!==index){uniforms.uEcho.value.copy(uniforms.uColor.value);previous=index;}
      tint.set(records[index].palette||'#73cfff');uniforms.uColor.value.lerp(tint,quiet?1:Math.min(1,dt*1.5));
      if(index!==queueIndex||indices!==queueReference){
        queueIndex=index;queueReference=indices;const at=Math.max(0,indices.indexOf(index));
        for(let i=0;i<copyCount;i++){const id=indices.length?indices[(at+i+1)%indices.length]:index;cells.set([id%columns,rows-1-Math.floor(id/columns)],i*2);}
        copyGeo.attributes.aCell.needsUpdate=true;
      }
      // Capture the caller's steady pose, then author the approach/reveal in depth.
      restPosition.copy(hero.position);restScale.copy(hero.scale);
      hero.visible=quiet||frame.stage==='reveal'||frame.stage==='hold'||frame.stage==='departure';
      if(!quiet&&frame.stage==='reveal'){
        const p=frame.assemble,ease=1-Math.pow(1-p,3);
        hero.position.set(restPosition.x*ease,restPosition.y*ease,-44*(1-ease));
        hero.scale.copy(restScale).multiplyScalar(.6+.4*ease+Math.sin(p*Math.PI)*.1);
        hero.rotation.y-=Math.pow(1-p,2)*1.35;hero.rotation.z+=(1-p)*.3;
      }
      if(!quiet&&frame.stage==='departure'){
        const p=frame.departure;
        hero.position.z=-65*p*p;hero.rotation.z-=p*.22;
        hero.scale.multiplyScalar(1-p*.85);
      }
      if(ambient&&frame.stage==='hold')copies.visible=false;else copies.visible=true;
    },
    resize(isMobile){copyGeo.instanceCount=Math.min(copyCount,isMobile?44:96);starGeo.instanceCount=Math.min(starCount,isMobile?650:1500);copyUniforms.uNarrow.value=isMobile?1:0;},
    dispose(){scene.remove(group);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();}
  };
}
