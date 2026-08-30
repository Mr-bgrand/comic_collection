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
function widestRun(hits, min, gapAllowance) {
  let best = null;
  let start = -1;
  let gap = 0;

  for (let i = 0; i < hits.length; i += 1) {
    if (hits[i] >= min) {
      if (start < 0) start = i;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap > gapAllowance) {
        const end = i - gap;
        if (!best || end - start > best.end - best.start) best = { start, end };
        start = -1;
        gap = 0;
      }
    }
  }
  if (start >= 0) {
    const end = hits.length - 1 - gap;
    if (!best || end - start > best.end - best.start) best = { start, end };
  }
  return best;
}
/**
 * Find the content box, in fractions of the image (0-1).
 * Returns null when the image is essentially uniform — a blank bed, a lens cap,
 * a scan that failed — because cropping that would produce nonsense.
 */
export function findContentBox(gray, width, height) {
  const threshold = matThreshold(gray, width, height);
  const bright = (x, y) => gray[y * width + x] > threshold;

  const rowHits = new Array(height).fill(0);
  const colHits = new Array(width).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (bright(x, y)) {
        rowHits[y] += 1;
        colHits[x] += 1;
      }
    }
  }

  const rowMin = Math.max(1, Math.floor(width * ROW_HIT_RATIO));
  const colMin = Math.max(1, Math.floor(height * ROW_HIT_RATIO));
  const gapX = Math.round(width * GAP_RATIO);
  const gapY = Math.round(height * GAP_RATIO);

  // Columns first. Spill usually sits beside the slab, so the horizontal
  // profile separates them most cleanly.
  const cols = widestRun(colHits, colMin, gapX);
  if (!cols) return null;

  // Then rows, counted only inside those columns - so spill above or below the
  // slab but outside its width cannot lengthen the box.
  const rowHitsInCols = new Array(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = cols.start; x <= cols.end; x += 1) {
      if (bright(x, y)) rowHitsInCols[y] += 1;
    }
  }
  // Rows are taken as the outer extent within those columns, not the widest
  // run. A dark cover is not uniformly bright - a foil scan has a white label,
  // a near-black middle and a bright holder edge - so the widest run would
  // return the label alone and crop the comic off its own scan. Inside the
  // slab's own columns there is no spill left to guard against.
  const rowMinInCols = Math.max(1, Math.floor((cols.end - cols.start + 1) * ROW_HIT_RATIO));
  const firstRowIn = rowHitsInCols.findIndex((n) => n >= rowMinInCols);
  const lastRowIn = rowHitsInCols.length - 1
    - [...rowHitsInCols].reverse().findIndex((n) => n >= rowMinInCols);
  if (firstRowIn < 0 || lastRowIn <= firstRowIn) return null;
  const rows = { start: firstRowIn, end: lastRowIn };
  const firstRow = rows.start;
  const lastRow = rows.end;
  const firstCol = cols.start;
  const lastCol = cols.end;
  if (firstRow < 0 || firstCol < 0 || lastRow <= firstRow || lastCol <= firstCol) return null;

  const boxW = (lastCol - firstCol + 1) / width;
  const boxH = (lastRow - firstRow + 1) / height;
  // A box covering nearly everything means nothing was found worth cropping to.
  if (boxW > 0.97 && boxH > 0.97) return null;
  // A sliver is a reflection or a stray object, not a comic.
  if (boxW < 0.1 || boxH < 0.1) return null;

  return {
    left: firstCol / width,
    top: firstRow / height,
    width: boxW,
    height: boxH,
  };
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
