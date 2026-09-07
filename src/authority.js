/** Normalize a reviewed Authority DOM capture, never an account-wide image list. */
export function acceptedAuthorityScan(url, side) {
  try {
    const u = new URL(url);
    return ['front', 'back'].includes(side) && u.protocol === 'https:' &&
      u.hostname === 'imga.theauthority.com' && !u.port && !u.username && !u.password && !u.hash &&
      /^\/i\/C4E\/[a-f0-9-]{36}$/.test(u.pathname) &&
      u.searchParams.getAll('Type').length === 1 &&
      u.searchParams.get('Type') === (side === 'front' ? 'Front' : 'Back') &&
      [...u.searchParams.keys()].every(key => ['Type', 'w'].includes(key));
  } catch { return false; }
}

export function normalizeAuthority(capture) {
  const id = capture.providerId;
  if (typeof id !== 'string' || !/^\d{10}$/.test(id)) throw new Error('Invalid Authority ID');
  if (![ `https://www.theauthority.com/Id/${id}`, `https://www.theauthority.com/${id}`, `https://id.theauthority.com/${id}` ].includes(capture.pageUrl)) throw new Error('Authority page/ID mismatch');
  if (!Array.isArray(capture.fields)) throw new Error('Missing rendered metadata rows');
  // The provider uses distinct "Item Number" and "Item number" fields.
  const field = label => capture.fields.find(row => row.label === label)?.value?.trim() || null;
  if (field('Certificate Number') !== id) throw new Error('Rendered certificate/ID mismatch');
  if (field('Collectible Type') !== 'Comic Book' || capture.status !== 'RAW Authentic') {
    throw new Error('Unreviewed Authority record type/status; inspect before importing');
  }
  if (!field('Product Simple Name') || !field('Item Number')) throw new Error('Missing comic identity');
  if (!capture.capturedAt || !Number.isFinite(Date.parse(capture.capturedAt))) throw new Error('Missing capture date');
  const scans = capture.scans || [];
  if (scans.length !== 2 || new Set(scans.map(scan => scan.side)).size !== 2 ||
      scans.some(scan => !acceptedAuthorityScan(scan.url, scan.side))) throw new Error('Unverified Authority scan pair');
  if (new Set(scans.map(scan => new URL(scan.url).pathname)).size !== 1) throw new Error('Scans refer to different internal items');
  const split = label => (field(label) || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    id: `Authority:${id}`, kind: 'comic', provider: 'Authority', providerId: id,
    cert: id, certUrl: capture.pageUrl, qrUrl: capture.qrUrl,
    title: field('Product Simple Name'), issue: field('Item Number'), variant: field('Description'),
    coverCode: field('Item number'), volume: field('Volume'), publisher: field('Manufacturer'),
    issueYear: field('Release Year'), issueDate: field('Printed Date'), onSaleDate: field('On Sale Date'),
    upc: field('UPC'), composition: field('Item Composition'), description: field('Detailed Description'),
    creators: { writers: split('Writers'), artists: split('Artists'), coverArtists: split('Cover Artists') },
    featuredCharacters: split('Featured Characters'),
    artComments: [field('Writers') && `Story: ${field('Writers')}`, field('Artists') && `Art: ${field('Artists')}`, field('Cover Artists') && `Cover: ${field('Cover Artists')}`].filter(Boolean).join('\n'),
    keyComments: capture.fields.filter(row => /^Fact \d+$/.test(row.label)).map(row => row.value).join(' · '),
    holder: 'soft-sleeve', holderSource: 'owner', grader: null, grade: null,
    grading: { status: 'raw', grader: null, grade: null },
    authentication: { provider: 'Authority', status: 'authentic', label: capture.status, sourceUrl: capture.pageUrl, capturedAt: capture.capturedAt },
    location: null, valuation: null, images: {}, imageSources: {},
    importSource: { provider: 'Authority', pageUrl: capture.pageUrl, capturedAt: capture.capturedAt, importedAt: capture.capturedAt },
  };
}

/** Preserve owner-entered location/value/notes when refreshing the same copy. */
export function mergeAuthority(records, incoming) {
  const index = records.findIndex(c => c.provider === 'Authority' && c.providerId === incoming.providerId);
  if (index < 0) return [...records, incoming];
  const previous = records[index];
  const merged = { ...previous, ...incoming };
  for (const key of ['location', 'valuation', 'manual', 'fmv', 'notes']) {
    if (Object.hasOwn(previous, key)) merged[key] = previous[key];
  }
  for(const side of ['front','back'])if(previous.imageSources?.[side]?.kind==='owner-photo'){
    merged.images[side]=previous.images[side];merged.imageSources[side]=previous.imageSources[side];
  }
  merged.importSource.importedAt = previous.importSource?.importedAt || incoming.importSource.importedAt;
  return records.map((c, i) => i === index ? merged : c);
}
