/** A stable ID connects physical storage, Admin, labels and collection deep links. */
export const containerId=b=>b.bin||b.id;
export function physicalContainers(collection){return [...collection.bins,...collection.cards,...collection.comics].filter(({data:b})=>b.bin||b.physical===true&&!b.virtual);}
export function printContainer(b){return b.bin?b:{...b,bin:b.id,isPhysicalCase:true,comics:b.comics||b.cards||[]};}
export function containerUrl(base,b){const root=base.replace(/\/$/,'');return b.isPhysicalCase?root+'/review/?case='+encodeURIComponent(b.bin):root+'/bin/'+encodeURIComponent(b.bin)+'/';}
