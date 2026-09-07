/** Deterministic formations: every physical copy keeps the same instance index. */
export function formation(mode, records, aspect=1.7, anchor=0) {
  const n=records.length;
  const boxKeys=[...new Set(records.map(c=>c.bin))];
  const boxes=new Map(boxKeys.map(key=>[key,records.filter(c=>c.bin===key)]));
  const used=new Map();
  return records.map((c,i)=>{
    if(mode==='spotlight') {
      const cols=aspect<.8?5:11,rows=Math.ceil(n/cols),row=Math.floor(i/cols),col=i%cols-(Math.min(cols,n)-1)/2;
      return {x:col*1.64,y:((rows-1)/2-row)*2.62,z:-4,rx:0,ry:0,rz:0,scale:1.48};
    }
    if(mode==='wall') {
      const cols=Math.max(5,Math.ceil(Math.sqrt(n*Math.max(.4,aspect)*1.62)));
      const rows=Math.ceil(n/cols), col=i%cols, row=Math.floor(i/cols);
      return {x:(col-(cols-1)/2)*1.21,y:((rows-1)/2-row)*1.85,z:-Math.pow((col-(cols-1)/2)/cols,2)*7,rx:0,ry:-(col-(cols-1)/2)/cols*.55,rz:0,scale:1};
    }
    if(mode==='longbox') {
      const columns=aspect<.8?3:6, box=boxKeys.indexOf(c.bin), at=used.get(c.bin)||0;used.set(c.bin,at+1);
      return {x:(box%columns-(Math.min(columns,boxKeys.length)-1)/2)*2.15,y:Math.floor(box/columns)*-3.5,z:-(at-(boxes.get(c.bin).length-1)/2)*.31-3,rx:-.18,ry:0,rz:0,scale:1.02};
    }
    const band=i%5, slot=Math.floor(i/5), total=Math.ceil((n-band)/5), a=slot/total*Math.PI*2 + band*.43;
    const radius=8.8+band*1.5;
    return {x:Math.cos(a)*radius,y:Math.sin(a)*radius*.64,z:-5.5-band*2+Math.sin(a*2+band)*2.1,rx:Math.sin(a)*.13,ry:-Math.cos(a)*.32,rz:-a*.13+band*.07,scale:.95+band*.045};
  });
}
export function cameraDistance(mode,aspect,count) {
  if(mode==='spotlight')return 12;
  if(mode==='wall') {
    const cols=Math.max(5,Math.ceil(Math.sqrt(count*Math.max(.4,aspect)*1.62))),rows=Math.ceil(count/cols);
    return Math.max((cols*1.21/Math.max(.3,aspect)),rows*1.85)*1.53;
  }
  if(mode==='longbox') return aspect<.8?27:23;
  return aspect<.8?20:18;
}
