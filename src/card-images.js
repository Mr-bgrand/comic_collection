/** Cert-page-discovered URLs only. Never infer an image identifier from a cert. */
export function acceptedCardImage(grader,source,side,cert,reversed=false) {
  if(!['front','back'].includes(side))return false;
  try {
    const url=new URL(source);if(url.protocol!=='https:'||url.username||url.password)return false;
    if(grader==='PSA')return url.hostname==='d1htnxwo4o0jhw.cloudfront.net'&&/^\/cert\/[^/]+\/.+\.(jpg|jpeg|png|webp)$/i.test(url.pathname);
    if(grader==='TAG')return url.hostname==='d39lwrz0lm7c9r.cloudfront.net'&&new RegExp('^/card-images/[^/]+_'+side.toUpperCase()+'_MAIN\\.(jpg|jpeg|png|webp)$','i').test(url.pathname);
    if(grader==='Arena Club')return url.hostname==='assets.arenaclub.com'&&!url.port&&!url.hash&&new RegExp('^/items/card_[a-f0-9-]{36}/slab_'+side+'\\.png$').test(url.pathname)&&[...url.searchParams.keys()].every(k=>['fit','w'].includes(k));
    if(grader==='CGC') {
      // All three hosts occur in the CGC Cards viewer, including legacy CGC
      // Comics and CSG scans. Accept only full-size, cert-matching card files.
      if(!['ccg-imaging-cgc-tradingcards-production.s3.amazonaws.com','ccg-imaging-cgc-comics-production.s3.amazonaws.com','ccg-imaging-csg-cards-production.s3.amazonaws.com'].includes(url.hostname))return false;
      const match=url.pathname.match(/^\/[a-f0-9-]{36}\/(CRD|CAR|CGC|CSG)(\d{7}|\d{10})-(\d{3})_(OBV|REV)\.jpg$/i);
      const sourceSide=reversed?(side==='front'?'back':'front'):side;
      return !!match && match[2]+match[3]===cert && match[4].toUpperCase()===(sourceSide==='front'?'OBV':'REV');
    }
  }catch{}
  return false;
}

export function acceptedCardCertPage(grader,source,cert) {
  try {
    const url=new URL(source);
    if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||!/^\w+$/.test(cert))return false;
    if(grader==='PSA')return url.hostname==='www.psacard.com'&&url.pathname===`/cert/${cert}/psa`;
    if(grader==='TAG')return url.hostname==='my.taggrading.com'&&url.pathname===`/card/${cert}`;
    if(grader==='Arena Club')return /^\dAC\d{9}$/.test(cert)&&url.hostname==='arenaclub.com'&&new RegExp('^/cards/[a-z0-9-]+-'+cert+'$').test(url.pathname);
    if(grader==='CGC')return /^\d{10}(\d{3})?$/.test(cert)&&url.hostname==='www.cgccards.com'&&new RegExp(`^/certlookup/${cert}/(?:[1-9]_[05]|10_0)/$`).test(url.pathname);
  }catch{}
  return false;
}
