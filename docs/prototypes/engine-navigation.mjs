/** Spotlight moves the viewpoint over a stable wall; picking never reorders it. */
export function wallMetrics(poses,aspect,zoom=1,height=800) {
  const visible=poses.filter(p=>p.scale>0),distance=12*zoom+4;
  const halfH=Math.tan(21*Math.PI/180)*distance,halfW=halfH*aspect;
  const xs=visible.map(p=>p.x),ys=visible.map(p=>p.y);
  const left=Math.min(0,...xs)-.85,right=Math.max(0,...xs)+.85;
  const bottom=Math.min(0,...ys)-1.3,top=Math.max(0,...ys)+1.3;
  return {halfW,halfH,unitsPerPixel:2*halfH/height,
    minX:Math.min((left+right)/2,left+halfW*.55),maxX:Math.max((left+right)/2,right-halfW*.55),
    minY:Math.min((bottom+top)/2,bottom+halfH*.55),maxY:Math.max((bottom+top)/2,top-halfH*.55)};
}
export function constrainWall(view,metrics) {
  return {...view,x:Math.max(metrics.minX,Math.min(metrics.maxX,view.x)),y:Math.max(metrics.minY,Math.min(metrics.maxY,view.y))};
}
export function moveWall(view,dx,dy,metrics) {
  return constrainWall({...view,x:view.x+dx*metrics.unitsPerPixel,y:view.y-dy*metrics.unitsPerPixel},metrics);
}
export function zoomWall(view,factor,poses,aspect,height,anchor={x:0,y:0}) {
  const before=wallMetrics(poses,aspect,view.zoom,height),zoom=Math.max(.35,Math.min(2.6,view.zoom*factor));
  const after=wallMetrics(poses,aspect,zoom,height);
  return constrainWall({zoom,x:view.x+anchor.x*(before.halfW-after.halfW),y:view.y+anchor.y*(before.halfH-after.halfH)},after);
}
