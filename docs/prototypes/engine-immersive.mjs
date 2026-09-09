// Case order is inventory order. Browsing wraps within the selected case only.
export function caseMembers(records, selected, scope='all') {
  return records.flatMap((c,i)=>c.bin===records[selected]?.bin&&(scope==='all'||c.kind===scope)?[i]:[]);
}
export function stepWithin(indices, selected, delta) {
  if(!indices.length)return selected;
  return indices[((indices.indexOf(selected)+delta)%indices.length+indices.length)%indices.length];
}
export function arrivalSequence(records, scope='all') {
  // Spread each type through the whole flight. Sequential scan IDs must not
  // strand all owner-scanned books together several minutes into the show.
  const hash=s=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0;};
  const groups=new Map();
  records.forEach((c,i)=>{
    if(!c.hasScan||(scope!=='all'&&c.kind!==scope))return;
    const group=c.kind==='card'?'card':c.id?.startsWith('raw:')||c.holder==='bag-and-board'?'owner-raw':c.holder==='soft-sleeve'?'soft-sleeve':'graded-comic';
    if(!groups.has(group))groups.set(group,[]);
    groups.get(group).push({i,key:hash(c.id||c.cert||String(i))});
  });
  return [...groups.values()].flatMap(group=>group.sort((a,b)=>a.key-b.key||a.i-b.i)
    .map((entry,index)=>({...entry,position:(index+.5)/group.length})))
    .sort((a,b)=>a.position-b.position||a.key-b.key||a.i-b.i).map(c=>c.i);
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

// The field cruises continuously; each copy arrives, stays readable, then departs.
// A paused/hidden tab never catches up by skipping unseen collection records.
export const ARRIVAL_REST=1.2;
export const ARRIVAL_DURATION=7.4;
export function arrivalFrame(elapsed) {
  const t=Math.max(0,Math.min(ARRIVAL_DURATION,elapsed));
  const clamp=v=>Math.max(0,Math.min(1,v)),holdEnd=ARRIVAL_REST+5;
  const stage=t<ARRIVAL_REST?'reveal':t<holdEnd?'hold':'departure';
  return {phase:t/ARRIVAL_DURATION,stage,assemble:clamp(t/ARRIVAL_REST),departure:clamp((t-holdEnd)/(ARRIVAL_DURATION-holdEnd)),
    speed:.24,fov:42,holdRemaining:stage==='hold'?Math.ceil(holdEnd-t):0};
}
export function advanceArrival(elapsed, dt, {active,playing,quiet,blocked}, duration=ARRIVAL_DURATION) {
  if(!active||!playing||quiet||blocked)return {elapsed,advance:false};
  const next=elapsed+Math.max(0,Math.min(dt,.1));
  return next>=duration?{elapsed:0,advance:true}:{elapsed:next,advance:false};
}
