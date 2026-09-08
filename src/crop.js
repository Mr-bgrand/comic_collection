/**
 * Crop a scanner bed image down to the slab.
 *
 * sharp's `trim` cannot do this job: it removes a uniform border, but the SV600's
 * mat is black and a CGC slab has a black frame, so trim either stops at the mat
 * edge or eats into the holder. A real scan came out with roughly a third of the
 * frame as dead mat.
 *
 * Brightness separates them cleanly instead. The mat is uniform; the
 * slab carries a bright blue label and colour artwork. So: find the bounding box
 * of everything meaningfully brighter than the mat, and cut there.
 */

const ANALYSIS_WIDTH = 240; // enough to locate an edge, cheap to scan
const MAT_RING_RATIO = 0.04; // outermost 4% of the frame: always mat
const MAT_MARGIN = 25; // how far above the mat a pixel must sit to be content
const MAT_PERCENTILE = 0.25; // robust to a slab occupying part of the ring
const ROW_HIT_RATIO = 0.02; // a row/column counts as content at 2% bright pixels
const GAP_RATIO = 0.06; // a dark band this wide does not split one slab in two
const MARGIN_RATIO = 0.012; // small breathing room so the holder is not clipped

/**
 * Where the mat ends and the slab begins, read off this image.
 *
 * A fixed threshold cannot work: bright mode raises the scanner's exposure to
 * pull detail from a foil cover, and lifts the mat with it. At 55 the whole bed
 * then read as content, nothing was cropped, and the full bed was saved.
 *
 * The mat's brightness is not knowable in advance, but its location is - the
 * outer edge of the bed is always mat, because a slab never reaches the border.
 * So the ring is sampled and the threshold set above whatever it turns out to
 * be, which holds at any exposure.
 */
export function matThreshold(gray, width, height) {
  const ringX = Math.max(1, Math.round(width * MAT_RING_RATIO));
  const ringY = Math.max(1, Math.round(height * MAT_RING_RATIO));

  const ring = [];
  for (let y = 0; y < height; y += 1) {
    const edgeRow = y < ringY || y >= height - ringY;
    for (let x = 0; x < width; x += 1) {
      if (!edgeRow && x >= ringX && x < width - ringX) continue;
      ring.push(gray[y * width + x]);
    }
  }
  if (!ring.length) return MAT_MARGIN;

  // A low percentile rather than the mean: a slab pushed flush against one edge
  // puts its own bright pixels in the ring, and an average would be dragged up
  // with them until the slab stopped counting as content at all.
  ring.sort((a, b) => a - b);
  const matLevel = ring[Math.floor(ring.length * MAT_PERCENTILE)];

  return Math.min(matLevel + MAT_MARGIN, 200);
}
/**
 * The widest solid run of content in a profile of hit counts.
 *
 * Taking the first and last index above the minimum spans everything bright in
 * the frame, including a patch of lamp spill on the mat several inches from the
 * slab. The slab is the one large solid block; spill is a smaller block with a
 * gap before it, so the longest run finds the slab and leaves the spill out.
 *
 * Short gaps are bridged: a dark band across a cover - a black panel, a shadow
 * between the holder and the label - must not split one slab into two runs.
 */
function solidRuns(hits, min, gapAllowance) {
  const runs = [];
  let start = -1;
  let gap = 0;

  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i] >= min) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap > gapAllowance) {
        runs.push({ start, end: i - gap });
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) runs.push({ start, end: hits.length - 1 - gap });
  return runs;
}

function widestRun(hits, min, gapAllowance) {
  let best = null;
  for (const run of solidRuns(hits, min, gapAllowance)) {
    if (!best || run.end - run.start > best.end - best.start) best = run;
  }
  return best;
}
/**
 * Find up to `max` content boxes, in fractions of the image (0-1), left to
 * right.
 *
 * One box is a slab on the mat. Two is the raw-comic case: bagged books scanned
 * side by side, with a run of bare mat between them, so the column profile has
 * two solid runs and each is a book. The runs are ranked by width and the
 * widest `max` kept - a patch of lamp spill is narrow and loses that contest.
 *
 * Returns [] when the bed is empty or uniform - a blank bed, a lens cap, a scan
 * that failed - because cropping that would produce nonsense.
 */
export function findContentBoxes(gray, width, height, { max = 1 } = {}) {
  const threshold = matThreshold(gray, width, height);
  const bright = (x, y) => gray[y * width + x] > threshold;

  const colHits = new Array(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (bright(x, y)) colHits[x] += 1;
    }
  }

  const colMin = Math.max(1, Math.floor(height * ROW_HIT_RATIO));
  const gapX = Math.round(width * GAP_RATIO);

  const runs = solidRuns(colHits, colMin, gapX)
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, max)
    .sort((a, b) => a.start - b.start);

  const out = [];
  for (const cols of runs) {
    // Rows are the outer extent within this run's columns, not the widest run:
    // a dark cover is not uniformly bright - a foil scan is a white label, a
    // near-black middle and a bright holder edge - and the widest run would
    // return the label alone. Inside the book's own columns there is no spill.
    const rowHits = new Array(height).fill(0);
    for (let y = 0; y < height; y += 1) {
      for (let x = cols.start; x <= cols.end; x += 1) {
        if (bright(x, y)) rowHits[y] += 1;
      }
    }
    const rowMin = Math.max(1, Math.floor((cols.end - cols.start + 1) * ROW_HIT_RATIO));
    const firstRow = rowHits.findIndex((n) => n >= rowMin);
    const lastRow = rowHits.length - 1 - [...rowHits].reverse().findIndex((n) => n >= rowMin);
    if (firstRow < 0 || lastRow <= firstRow) continue;

    const boxW = (cols.end - cols.start + 1) / width;
    const boxH = (lastRow - firstRow + 1) / height;
    // A box covering nearly everything means nothing was found worth cropping to.
    if (boxW > 0.97 && boxH > 0.97) continue;
    // A sliver is a reflection or a stray object, not a comic.
    if (boxW < 0.1 || boxH < 0.1) continue;

    out.push({ left: cols.start / width, top: firstRow / height, width: boxW, height: boxH });
  }
  return out;
}

/** The single content box - the widest one - or null. */
export function findContentBox(gray, width, height) {
  return findContentBoxes(gray, width, height, { max: 1 })[0] ?? null;
}
/**
 * Crop an image buffer/path to its slab and normalise it.
 * Falls back to the uncropped image whenever the box looks implausible — a wide
 * margin is a cosmetic problem, a wrongly cropped cover is a data problem.
 */
export async function cropToSlab(input, { maxEdge = 1400, quality = 88 } = {}) {
  const { default: sharp } = await import('sharp');

  const base = sharp(input).rotate();
  const meta = await base.clone().metadata();
  if (!meta.width || !meta.height) throw new Error('unreadable image');

  const small = await base
    .clone()
    .resize({ width: ANALYSIS_WIDTH })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const box = findContentBox(small.data, small.info.width, small.info.height);

  let pipeline = sharp(input).rotate();
  if (box) {
    const margin = MARGIN_RATIO;
    const left = Math.max(0, Math.round((box.left - margin) * meta.width));
    const top = Math.max(0, Math.round((box.top - margin) * meta.height));
    const width = Math.min(meta.width - left, Math.round((box.width + margin * 2) * meta.width));
    const height = Math.min(meta.height - top, Math.round((box.height + margin * 2) * meta.height));
    pipeline = pipeline.extract({ left, top, width, height });
  }

  const out = await pipeline
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, progressive: true })
    .toBuffer();

  return { buffer: out, cropped: Boolean(box) };
}

/**
 * Crop a bed holding up to `max` books into one image per book, left to right.
 *
 * The raw-comic case: fronts scanned two at a time. Each book is cropped and
 * scaled exactly as a single slab would be. When nothing can be found the whole
 * bed comes back as one image, so a scan is never silently lost to a bad guess.
 *
 * @returns {Promise<Array<{buffer: Buffer, box: object | null}>>}
 */
export async function cropToSlabs(input, { max = 2, maxEdge = 1400, quality = 88 } = {}) {
  const { default: sharp } = await import('sharp');

  const base = sharp(input).rotate();
  const meta = await base.clone().metadata();
  if (!meta.width || !meta.height) throw new Error('unreadable image');

  const small = await base
    .clone()
    .resize({ width: ANALYSIS_WIDTH })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const boxes = findContentBoxes(small.data, small.info.width, small.info.height, { max });
  const targets = boxes.length ? boxes : [null];

  const out = [];
  for (const box of targets) {
    let pipeline = sharp(input).rotate();
    if (box) {
      const margin = MARGIN_RATIO;
      const left = Math.max(0, Math.round((box.left - margin) * meta.width));
      const top = Math.max(0, Math.round((box.top - margin) * meta.height));
      const width = Math.min(meta.width - left, Math.round((box.width + margin * 2) * meta.width));
      const height = Math.min(meta.height - top, Math.round((box.height + margin * 2) * meta.height));
      pipeline = pipeline.extract({ left, top, width, height });
    }
    const buffer = await pipeline
      .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    out.push({ buffer, box });
  }
  return out;
}
