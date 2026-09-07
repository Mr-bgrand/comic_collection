// Case order is inventory order. Browsing wraps within the selected case only.
export function caseMembers(records, selected, scope='all') {
  return records.flatMap((c,i)=>c.bin===records[selected]?.bin&&(scope==='all'||c.kind===scope)?[i]:[]);
}
export function stepWithin(indices, selected, delta) {
  if(!indices.length)return selected;
  return indices[((indices.indexOf(selected)+delta)%indices.length+indices.length)%indices.length];
}
export function arrivalSequence(records, scope='all') {
  const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
  return records.flatMap((c,i)=>c.hasScan&&(scope==='all'||c.kind===scope)?[{i,key:hash(c.id||c.cert||String(i))}]:[]).sort((a,b)=>a.key-b.key||a.i-b.i).map(c=>c.i);
}
export function caseFormation(records, selected, aspect, scope='all') {
  const members=caseMembers(records,selected,scope),at=members.indexOf(selected),mobile=aspect<.8;
  const byIndex=new Map(members.map((id,i)=>[id,i]));
  return records.map((c,i)=>{
    if(!byIndex.has(i))return {x:0,y:-18,z:-65,rx:0,ry:0,rz:0,scale:0};
    let d=(byIndex.get(i)-at+members.length)%members.length;
    if(d>members.length/2)d-=members.length;
    const sign=Math.sign(d),n=Math.abs(d),a=Math.min(n,20)*.125,tail=Math.max(0,n-20);
    return mobile
      ? {x:sign*(.7+Math.sin(a)*1.6),y:1.05+sign*(2.7+Math.sin(a)*4.6),z:-n*.24-tail*.32,
          rx:sign*(.15+a*.12),ry:-sign*.22,rz:sign*a*.08,scale:n?1.7:2.3}
      : {x:-1.2+sign*(2.6+Math.sin(a)*6.8),y:1.1-(1-Math.cos(a))*3.3,z:-n*.23-tail*.3,
          rx:.03,ry:-sign*(.25+a*.25),rz:-sign*a*.09,scale:n?2.15:3.2};
  });
}

// A visible arrival rests for most of its five-second cycle. It is never advanced
// by wall-clock catch-up after a hidden tab, pause, or a reduced-motion session.
export function arrivalFrame(elapsed, duration=5) {
  const phase=Math.max(0,Math.min(1,elapsed/duration));
  return {phase,assemble:Math.min(1,elapsed/1.15),capture:Math.max(0,Math.min(1,(elapsed-3.65)/1.35))};
}
export function advanceArrival(elapsed, dt, {active,playing,quiet,blocked}, duration=5) {
  if(!active||!playing||quiet||blocked)return {elapsed,advance:false};
  const next=elapsed+Math.max(0,Math.min(dt,.1));
  return next>=duration?{elapsed:0,advance:true}:{elapsed:next,advance:false};
}
