/**
 * Crop a scanner bed image down to the slab.
 *
 * sharp's `trim` cannot do this job: it removes a uniform border, but the SV600's
 * mat is black and a CGC slab has a black frame, so trim either stops at the mat
 * edge or eats into the holder. A real scan came out with roughly a third of the
 * frame as dead mat.
 *
 * Brightness separates them cleanly instead. The mat is uniformly near-black; the
 * slab carries a bright blue label and colour artwork. So: find the bounding box
 * of everything meaningfully brighter than the mat, and cut there.
 */

const ANALYSIS_WIDTH = 240; // enough to locate an edge, cheap to scan
const BRIGHTNESS_THRESHOLD = 55; // 0-255; mat sits far below this
const ROW_HIT_RATIO = 0.02; // a row/column counts as content at 2% bright pixels
const MARGIN_RATIO = 0.012; // small breathing room so the holder is not clipped

/**
 * Find the content box, in fractions of the image (0-1).
 * Returns null when the image is essentially uniform — a blank bed, a lens cap,
 * a scan that failed — because cropping that would produce nonsense.
 */
export function findContentBox(gray, width, height) {
  const bright = (x, y) => gray[y * width + x] > BRIGHTNESS_THRESHOLD;

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

  const firstRow = rowHits.findIndex((n) => n >= rowMin);
  const lastRow = rowHits.length - 1 - [...rowHits].reverse().findIndex((n) => n >= rowMin);
  const firstCol = colHits.findIndex((n) => n >= colMin);
  const lastCol = colHits.length - 1 - [...colHits].reverse().findIndex((n) => n >= colMin);

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
