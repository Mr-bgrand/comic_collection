/**
 * Raw comics: identity and records for books that have no cert.
 *
 * Everything else in this collection is keyed by a grader's certificate number.
 * A raw comic scanned before anyone has worked out what it is has nothing of
 * the kind - many are virgin covers with no text at all - so it is given a
 * stable sequential id within its bin. The position a book occupies is the one
 * fact known for certain at scan time, and it is what a later matching pass
 * writes its answer against.
 *
 * The record uses the same raw shape the Authority import writes (grading
 * status, holder, provider), so the Lab, print and stats treat it as one more
 * raw comic rather than a special case. What it adds is scan provenance - which
 * bed, which side of the bed - and an `identification` slot for the step that
 * has been deliberately deferred.
 */

const pad = (n, width) => String(n).padStart(width, '0');

/** `raw:15-001` */
export function rawId(bin, sequence) {
  return `raw:${bin}-${pad(sequence, 3)}`;
}

/** `Raw_15-001_FRONT.jpg` - the `<Provider>_<id>_<SIDE>.jpg` convention. */
export function rawImageName(id, side) {
  const local = String(id).replace(/^raw:/, '');
  return `Raw_${local}_${side === 'back' ? 'BACK' : 'FRONT'}.jpg`;
}

/** One past the highest raw sequence already in this bin; 1 if none. */
export function nextRawSequence(bin, comics) {
  const prefix = `raw:${bin}-`;
  let highest = 0;
  for (const comic of comics ?? []) {
    const id = String(comic?.id ?? '');
    if (!id.startsWith(prefix)) continue;
    const n = Number(id.slice(prefix.length));
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return highest + 1;
}

/**
 * Hand out sequence numbers for one bed: the ids a rescan freed first, in
 * order, then onward from past everything - freed or stored. Computing "next"
 * from the bin alone, after the freed records were removed, restarted the
 * sequence underneath the id being reused, and two books became one.
 */
export function makeSequenceAllocator(bin, comics, freed = []) {
  const queue = [...new Set(freed)].sort((a, b) => a - b);
  let next = Math.max(nextRawSequence(bin, comics), (queue[queue.length - 1] ?? 0) + 1);
  return () => (queue.length ? queue.shift() : next++);
}

/** `raw-15-scan-007` - names the bed, not a book, so a bed can be re-cropped. */
export function bedId(bin, scanNumber) {
  return `raw-${bin}-scan-${pad(scanNumber, 3)}`;
}

/** The highest scan number a bin's records refer to; 0 if none. */
export function lastScanNumber(bin, comics) {
  const re = new RegExp(`^raw-${bin}-scan-(\\d+)$`);
  let highest = 0;
  for (const comic of comics ?? []) {
    const m = re.exec(comic?.imageSources?.front?.bed ?? '');
    if (m) highest = Math.max(highest, Number(m[1]));
  }
  return highest;
}

/** The records one bed produced - what "again" replaces. */
export function recordsFromBed(comics, bed) {
  return (comics ?? []).filter((c) => c?.imageSources?.front?.bed === bed);
}

export function emptyRawBin(bin) {
  return {
    id: `comic-bin-${bin}`,
    title: `Comic Bin #${bin} (Raw)`,
    physical: true,
    location: `Comic Bin #${bin}`,
    comics: [],
  };
}

/**
 * A front-only, unidentified raw comic.
 *
 * @param {object} p
 * @param {string} p.bin
 * @param {number} p.sequence
 * @param {string} p.bed          the kept bed image this came from
 * @param {'left'|'right'|'only'} p.position  where on the bed
 * @param {number} p.width        saved image width
 * @param {number} p.height
 * @param {string} p.sha256       of the saved image
 * @param {string} p.now          ISO timestamp
 */
export function rawRecord({ bin, sequence, bed, position, width, height, sha256, now }) {
  const id = rawId(bin, sequence);
  const front = rawImageName(id, 'front');
  return {
    id,
    kind: 'comic',
    provider: null,
    providerId: null,
    cert: null,
    title: null,
    issue: null,
    variant: null,
    publisher: null,
    issueYear: null,
    holder: 'bag-and-board',
    holderSource: 'owner',
    grader: null,
    grade: null,
    grading: { status: 'raw', grader: null, grade: null },
    authentication: null,
    identification: { status: 'unidentified', candidates: [] },
    location: `Comic Bin #${bin}`,
    valuation: null,
    images: { front },
    imageSources: {
      front: {
        kind: 'owner-scan',
        side: 'front',
        bed,
        position,
        retrievedAt: now,
        originalWidth: width,
        originalHeight: height,
        sha256,
      },
    },
    imageSource: 'owner',
    scanStatus: 'front-only',
    importSource: { provider: 'owner-scan', importedAt: now },
  };
}
