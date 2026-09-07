// One cover atlas supplies the debris and arrival mosaic. No per-fragment textures,
// geometry allocation, or DOM animation occurs in the render loop.
export function createSingularity(THREE, {scene,foreground,atlas,columns,rows,records,mobile}) {
  const group=new THREE.Group();scene.add(group);group.visible=false;
  const common={uTime:{value:0},uColor:{value:new THREE.Color('#90d5ff')},uEcho:{value:new THREE.Color('#d4a5ff')},uSurge:{value:0},uQuiet:{value:0}};
  const diskGeo=new THREE.PlaneGeometry(40,30);
  const disk=new THREE.Mesh(diskGeo,new THREE.ShaderMaterial({uniforms:common,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime,uSurge,uQuiet;uniform vec3 uColor,uEcho;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){vec2 p=(vUv-.5)*vec2(2.,1.5);float r=length(p),a=atan(p.y,p.x);float t=uTime*.13;
      float bend=length(vec2(p.x,p.y*3.7));
      float edge=exp(-abs(r-.245)*140.);float glow=exp(-abs(r-.252)*25.);
      float filaments=pow(.5+.5*sin(bend*280.-a*5.-t*13.+sin(a*9.+t)*1.7),4.);
      float diskBand=exp(-abs(bend-.43)*10.)*smoothstep(.23,.31,r);
      float arc=pow(.5+.5*sin(a*3.+r*82.-t*5.),6.);
      float wake=exp(-abs(r-(.25+uSurge*.55))*65.)*uSurge;
      vec3 foil=.5+.5*cos(vec3(0.,2.1,4.2)+a*2.+r*20.-t);
      vec3 col=mix(uColor,uEcho,.5+.5*sin(a+t))*glow*.32;
      col+=mix(uColor,vec3(1.),.78)*edge*1.1;
      col+=mix(uColor,foil,.45)*diskBand*(.2+filaments*.8)*(1.+arc)*1.5;
      col+=uEcho*wake*.45;float mask=smoothstep(.237,.245,r);
      float alpha=max(max(glow*.6,edge),diskBand*.85)+wake*.25;
      // The center is opaque black, with the dust and mosaic behind the horizon.
      if(r<.241){gl_FragColor=vec4(.002,.004,.009,1.);return;}
      gl_FragColor=vec4(col*mask,clamp(alpha,0.,.96));}`
  }));disk.position.set(mobile?0:3.7,mobile?.3:.9,-7);disk.scale.setScalar(.78);disk.rotation.z=-.18;disk.renderOrder=3;group.add(disk);

  const count=mobile?2300:5600,geo=new THREE.InstancedBufferGeometry();
  const base=new THREE.PlaneGeometry(1,1);geo.index=base.index;geo.attributes.position=base.attributes.position;geo.attributes.uv=base.attributes.uv;
  const seeds=new Float32Array(count*4),cells=new Float32Array(count*2);
  for(let i=0;i<count;i++){const rand=n=>{const x=Math.sin(i*127.1+n*311.7)*43758.5453;return x-Math.floor(x);};seeds.set([rand(1),rand(2),rand(3),rand(4)],i*4);const id=i%records.length;cells.set([id%columns,rows-1-Math.floor(id/columns)],i*2);}
  geo.setAttribute('aSeed',new THREE.InstancedBufferAttribute(seeds,4));geo.setAttribute('aCell',new THREE.InstancedBufferAttribute(cells,2));geo.instanceCount=count;
  const debrisMat=new THREE.ShaderMaterial({uniforms:{...common,uAtlas:{value:atlas},uGrid:{value:new THREE.Vector2(columns,rows)}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    vertexShader:`attribute vec4 aSeed;attribute vec2 aCell;varying vec2 vUv,vCell;varying float vGlint,vFade;uniform float uTime,uQuiet;
    void main(){float t=uTime*(1.-uQuiet);float travel=fract(aSeed.x+t*.022);float r=2.7+pow(travel,.64)*21.;float a=aSeed.y*6.283+t*.07+(1.-travel)*4.5;
      vec3 center=vec3(cos(a)*r,sin(a)*r*.44,-9.+aSeed.z*7.);
      float size=.025+pow(aSeed.w,7.)*.34;float turn=aSeed.y*6.28+t*(aSeed.w-.5);
      vec2 q=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*position.xy*size;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(center+vec3(q,0.),1.);
      vUv=uv;vCell=aCell;vGlint=pow(max(0.,sin(aSeed.z*80.+t*(.6+aSeed.w))),18.);vFade=smoothstep(0.,.12,travel);}`,
    fragmentShader:`varying vec2 vUv,vCell;varying float vGlint,vFade;uniform sampler2D uAtlas;uniform vec2 uGrid;uniform vec3 uColor,uEcho;
    void main(){vec2 uv=(vCell+clamp(vUv*.32+vec2(.3,.37),.01,.99))/uGrid;vec3 art=texture2D(uAtlas,uv).rgb;
      vec3 foil=mix(uColor,uEcho,vUv.x);gl_FragColor=vec4(art*.82+foil*vGlint*1.5,(.26+vGlint*.65)*vFade);}`
  });
  const debris=new THREE.Mesh(geo,debrisMat);debris.frustumCulled=false;debris.position.x=mobile?0:3.7;group.add(debris);

  const incomingUniforms={...common,uAtlas:{value:atlas},uGrid:{value:new THREE.Vector2(columns,rows)},uCell:{value:new THREE.Vector2()},uCapture:{value:0}};
  const incoming=new THREE.Mesh(new THREE.PlaneGeometry(1,1.578,24,40),new THREE.ShaderMaterial({uniforms:incomingUniforms,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec2 vUv;uniform float uCapture,uTime;void main(){vUv=uv;float p=uCapture;vec3 pos=position;
      pos.x*=1.-p*.94;pos.y*=1.+sin(p*3.14159)*3.;pos.x+=sin(pos.y*1.3+p*6.)*p*.7;
      pos.z+=pow(abs(pos.y),1.4)*p*.45;gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform sampler2D uAtlas;uniform vec2 uGrid,uCell;uniform float uCapture;uniform vec3 uColor;
    void main(){vec3 col=texture2D(uAtlas,(uCell+clamp(vUv,.008,.992))/uGrid).rgb;col+=uColor*pow(uCapture,2.)*.7;gl_FragColor=vec4(col,1.-smoothstep(.78,1.,uCapture));}`
  }));group.add(incoming);incoming.renderOrder=4;

  // Tiles of the arriving copy leave a spiral and resolve into its exact atlas cell.
  const nx=mobile?22:32,ny=mobile?34:50,total=nx*ny;
  const tileGeo=new THREE.InstancedBufferGeometry();tileGeo.index=base.index;tileGeo.attributes.position=base.attributes.position;tileGeo.attributes.uv=base.attributes.uv;
  const tile=new Float32Array(total*2);for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)tile.set([x,y],(y*nx+x)*2);
  tileGeo.setAttribute('aTile',new THREE.InstancedBufferAttribute(tile,2));tileGeo.instanceCount=total;
  const arrivalUniforms={...common,uAtlas:{value:atlas},uGrid:{value:new THREE.Vector2(columns,rows)},uTiles:{value:new THREE.Vector2(nx,ny)},uCell:{value:new THREE.Vector2()},uProgress:{value:1},uAlpha:{value:0}};
  const mosaic=new THREE.Mesh(tileGeo,new THREE.ShaderMaterial({uniforms:arrivalUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    vertexShader:`attribute vec2 aTile;uniform vec2 uTiles;uniform float uProgress;varying vec2 vUv;varying float vSpark;
    void main(){vec2 tile=(aTile+.5)/uTiles;float seed=fract(sin(dot(aTile,vec2(12.98,78.23)))*43758.54);
      float p=smoothstep(seed*.18,.82+seed*.18,uProgress);float a=seed*6.283+(1.-p)*9.;
      vec3 start=vec3(2.7+cos(a)*(1.+seed*3.),sin(a)*(1.+seed*2.),-5.-seed*6.);
      vec3 end=vec3(tile.x-.5,(tile.y-.5)*1.578,0.);
      vec3 pos=mix(start,end,p)+vec3(position.x/uTiles.x,position.y/uTiles.y*1.578,0.);
      vUv=(aTile+uv)/uTiles;vSpark=sin(seed*200.+p*18.)*(1.-p);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`,
    fragmentShader:`varying vec2 vUv;varying float vSpark;uniform sampler2D uAtlas;uniform vec2 uGrid,uCell;uniform float uAlpha;uniform vec3 uColor;
    void main(){vec3 color=texture2D(uAtlas,(uCell+clamp(vUv,.008,.992))/uGrid).rgb;gl_FragColor=vec4(color+uColor*max(0.,vSpark)*.6,uAlpha);}`
  }));mosaic.frustumCulled=false;foreground.add(mosaic);mosaic.visible=false;
  const color=new THREE.Color();let previous=-1;
  return {
    update({active,time,progress,capture,index,nextIndex,quiet,hero,assemble}){
      group.visible=active;mosaic.visible=active&&!quiet&&assemble<1;
      if(!active)return;
      common.uTime.value=time;common.uQuiet.value=quiet?1:0;common.uSurge.value=capture;
      if(previous!==index){common.uEcho.value.copy(common.uColor.value);previous=index;}
      color.set(records[index].palette||'#93bedd');common.uColor.value.lerp(color,.025);
      arrivalUniforms.uCell.value.set(index%columns,rows-1-Math.floor(index/columns));
      incomingUniforms.uCell.value.set(nextIndex%columns,rows-1-Math.floor(nextIndex/columns));incomingUniforms.uCapture.value=capture;
      incoming.visible=!quiet&&capture>0;
      incoming.position.set(disk.position.x+6.5*(1-capture),disk.position.y+1.3*(1-capture),-6+capture*.3);
      incoming.rotation.z=-.35-capture*1.7;incoming.scale.setScalar(1.5*(1-capture*.7));
      arrivalUniforms.uProgress.value=assemble;arrivalUniforms.uAlpha.value=1-Math.max(0,(assemble-.82)/.18);
      mosaic.position.copy(hero.position);mosaic.rotation.copy(hero.rotation);mosaic.scale.copy(hero.scale);
    },
    resize(isMobile){disk.position.x=debris.position.x=isMobile?0:3.7;disk.position.y=isMobile?.3:.9;geo.instanceCount=Math.min(count,isMobile?2300:5600);},
    dispose(){scene.remove(group);foreground.remove(mosaic);diskGeo.dispose();disk.material.dispose();geo.dispose();debrisMat.dispose();tileGeo.dispose();mosaic.material.dispose();incoming.geometry.dispose();incoming.material.dispose();base.dispose();}
  };
}
