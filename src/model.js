/**
 * Presentation logic shared by the label, the sheet, and the web pages.
 * Pure functions only — no I/O, no templates.
 */

/**
 * The title as printed on the CGC slab, variant and all, so a book can be
 * verified against the paperwork by direct comparison.
 *
 *   Venom #23 : Black Saber Comics "Virgin" Edition
 */
export function displayTitle(comic) {
  const base = `${comic.title ?? ''} #${comic.issue ?? ''}`.trim();
  const variant = (comic.variant ?? '').trim();
  return variant ? `${base} : ${variant}` : base;
}

/** True only when CGC reports nothing graded higher. Missing data is not top pop. */
export function isTopPop(comic) {
  const pop = comic?.population;
  return Boolean(pop) && typeof pop.higher === 'number' && pop.higher === 0;
}

/** One 4x6 label row. Title and grade stay separate so the grade column aligns. */
export function labelRow(comic) {
  return {
    cert: comic.cert,
    title: displayTitle(comic),
    grade: comic.grade ?? '',
    star: isTopPop(comic),
  };
}

/** "WHITE" -> "White pages". CGC shouts; the sheet doesn't have to. */
export function formatPageQuality(quality) {
  if (!quality) return '';
  const lower = String(quality).toLowerCase();
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)} pages`;
}

/**
 * CGC fills unknown dates with placeholders rather than leaving them empty, so
 * undated books come back as "No Date" and year 1900. Printing those as if they
 * were real data is worse than printing nothing. (No comic book is from 1900 —
 * the format dates to the 1930s — so the year is safe to treat as a placeholder.)
 */
const PLACEHOLDERS = new Set(['no date', 'n/a', 'none', 'unknown', '1900', '0']);

function meaningful(value) {
  const text = (value ?? '').toString().trim();
  return text && !PLACEHOLDERS.has(text.toLowerCase()) ? text : '';
}

/** Publisher / date / year / label category / page quality, placeholders removed. */
function metaParts(comic) {
  return [
    comic.publisher,
    comic.issueDate,
    comic.issueYear,
    comic.labelCategory,
    formatPageQuality(comic.pageQuality),
  ]
    .map(meaningful)
    .filter(Boolean);
}

/**
 * Every remaining CGC field, as lines for the sheet and the bin page.
 * Absent fields are dropped rather than printed as blanks or separators.
 */
export function detailLines(comic) {
  const lines = [];

  const meta = metaParts(comic);
  if (meta.length) lines.push(meta.join(' · '));

  if (comic.artComments) {
    lines.push(
      ...comic.artComments.split('\n').map((s) => s.trim()).filter(Boolean),
    );
  }

  const tail = [];
  if (comic.keyComments) tail.push(`Key: ${comic.keyComments}`);
  if (comic.gradeDate) tail.push(`Graded ${comic.gradeDate}`);
  if (comic.cert) tail.push(`Cert ${comic.cert}`);
  if (tail.length) lines.push(tail.join(' · '));

  const pop = comic.population;
  if (isTopPop(comic)) {
    lines.push(`★ Top Pop — ${pop.atGrade} in ${comic.grade}, none higher`);
  } else if (pop && typeof pop.higher === 'number') {
    lines.push(`${pop.atGrade} in ${comic.grade} · ${pop.higher} graded higher`);
  }

  return lines;
}

/**
 * Average glyph width as a fraction of font size, for the label's condensed sans
 * stack. Empirical and deliberately slightly generous — overestimating width
 * shrinks a line that would have fit, which is harmless; underestimating lets a
 * title collide with the grade column, which is not.
 *
 * Sized for the bold weight the label rows are set in; bold glyphs run wider than
 * regular, so this is above the ~0.5 a regular face would need.
 */
const AVG_GLYPH_RATIO = 0.53;

/**
 * Pick a font size that keeps a title on one line inside `maxWidthIn`.
 *
 * The 4x6 label shrinks long variant strings rather than wrapping them, so the
 * grade column stays straight down the page. Anything that cannot fit even at
 * the minimum size is ellipsised by CSS as a backstop.
 */
export function fitFontSize(text, maxWidthIn, { maxPt = 9.5, minPt = 6.5 } = {}) {
  const chars = String(text ?? '').length;
  if (!chars) return maxPt;
  const ideal = (maxWidthIn * 72) / (chars * AVG_GLYPH_RATIO);
  return Math.max(minPt, Math.min(maxPt, Math.round(ideal * 10) / 10));
}

/**
 * The same information as `detailLines`, folded onto at most three lines.
 *
 * The sheet has a hard height budget — 13 entries must fit one side — so art
 * credits are joined onto a single line and population is merged into the tail
 * rather than each taking a line of its own. Nothing is dropped, only folded.
 */
export function compactDetailLines(comic) {
  const lines = [];

  const meta = metaParts(comic);
  if (meta.length) lines.push(meta.join(' · '));

  if (comic.artComments) {
    const credits = comic.artComments
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' · ');
    if (credits) lines.push(credits);
  }

  /*
   * Ordered most-valuable first, because this line is clipped rather than
   * wrapped on the printed sheet. Population came last once, and a book that was
   * the only 9.8 in existence had exactly that fact cut off the page. Key
   * comments are the longest and most variable, so they absorb the truncation.
   */
  const tail = [];
  const pop = comic.population;
  if (isTopPop(comic)) {
    tail.push(`★ Top Pop — ${pop.atGrade} in ${comic.grade}, none higher`);
  } else if (pop && typeof pop.higher === 'number') {
    tail.push(`${pop.atGrade} in ${comic.grade} · ${pop.higher} higher`);
  }
  if (comic.cert) tail.push(`Cert ${comic.cert}`);
  if (comic.gradeDate) tail.push(`Graded ${comic.gradeDate}`);
  if (comic.keyComments) tail.push(`Key: ${comic.keyComments}`);

  if (tail.length) lines.push(tail.join(' · '));

  return lines;
}

/**
 * Row geometry for the 4x6 label, derived from the space actually available
 * rather than assumed.
 *
 * The first cut of this hard-coded a row height that happened to overflow a 4x6
 * page by 1.9in. Dividing the real remaining space by the real comic count means
 * the label fits whatever a bin holds — 20 comics or 30 — without re-tuning CSS.
 */
export function labelMetrics(count, {
  usableHeightIn = 5.64, // 6in page less 0.18in margins
  headerIn = 1.16, // QR block plus rule
  footerIn = 0.2,
  gapIn = 0.06,
  maxPt = 9.5,
  minPt = 5,
  lineRatio = 1.22,
  // Printers and PDF engines round; landing exactly on the page height pushes a
  // second page. Keep a little back.
  safetyIn = 0.05,
} = {}) {
  const availableIn = usableHeightIn - headerIn - footerIn - gapIn - safetyIn;
  const rowHeightIn = count > 0 ? availableIn / count : availableIn;
  const raw = (rowHeightIn * 72) / lineRatio;
  const titlePt = Math.max(minPt, Math.min(maxPt, Math.floor(raw * 10) / 10));
  return {
    availableIn: Number(availableIn.toFixed(3)),
    rowHeightIn: Number(rowHeightIn.toFixed(4)),
    titlePt,
    gradePt: Number(Math.min(titlePt + 0.5, maxPt + 0.5).toFixed(1)),
    overflows: titlePt <= minPt && raw < minPt,
  };
}

/** Split a bin across sheet sides. 25 comics at 13 per side = two sides, one sheet. */
export function paginate(items, perPage) {
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

/** The QR destination for a bin. */
export function binUrl(baseUrl, bin) {
  return `${String(baseUrl).replace(/\/+$/, '')}/bin/${bin}/`;
}

/** GoCollect fair market value, or null when the book has not been priced yet. */
export function fmvValue(comic) {
  const v = comic?.fmv?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * A value entered by hand, for books no market source carries.
 *
 * 13 of 46 books are retailer exclusives GoCollect does not track, and eBay
 * cannot reliably identify them either. A manual figure is the honest fallback —
 * but it is a different kind of fact from a sales-derived one, so it is stored
 * separately and never merged into a market figure without saying so.
 */
export function manualValue(comic) {
  const v = comic?.manual?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Market value if there is one, otherwise the hand-entered estimate. */
export function effectiveValue(comic) {
  return fmvValue(comic) ?? manualValue(comic);
}

/** Where a book's value came from — so the UI can always say which. */
export function valueSource(comic) {
  if (fmvValue(comic) !== null) return 'market';
  if (manualValue(comic) !== null) return 'manual';
  return null;
}

/**
 * Headline numbers for the dashboard.
 *
 * `priced` is reported separately from `comics` on purpose: a total is misleading
 * if you cannot see how much of the collection it actually covers. Market and
 * manual money are also kept apart, for the same reason.
 */
export function collectionStats(bins) {
  let comics = 0;
  let priced = 0;
  let totalValue = 0;
  let topPop = 0;
  let oldestFmv = null;
  let noSales = 0;
  let notListed = 0;
  let unfetched = 0;
  let manualCount = 0;
  let manualTotal = 0;

  for (const bin of bins) {
    for (const comic of bin.comics ?? []) {
      comics += 1;
      if (isTopPop(comic)) topPop += 1;

      const manual = manualValue(comic);
      if (manual !== null && fmvValue(comic) === null) {
        manualCount += 1;
        manualTotal += manual;
      }

      const value = fmvValue(comic);
      if (value !== null) {
        priced += 1;
        totalValue += value;
      } else if (!comic.fmv) {
        unfetched += 1; // never looked up — running the fetch would help
      } else if (comic.fmv.status === 'no-sales') {
        noSales += 1; // listed on GoCollect, nothing has sold
      } else {
        notListed += 1; // GoCollect does not carry this book
      }

      const at = comic.fmv?.fetchedAt;
      if (at && (!oldestFmv || at < oldestFmv)) oldestFmv = at;
    }
  }

  return {
    bins: bins.length,
    comics,
    priced,
    unpriced: comics - priced,
    noSales,
    notListed,
    unfetched,
    // Market money and hand-entered money, kept apart. `combinedValue` exists for
    // when a single figure is genuinely wanted, and the UI must label it as
    // including estimates whenever manualTotal is non-zero.
    totalValue,
    manualCount,
    manualTotal,
    combinedValue: totalValue + manualTotal,
    valued: priced + manualCount,
    topPop,
    oldestFmv,
  };
}

/** Counts by grade, highest grade first. Grades are ordinal, so order is fixed. */
export function gradeDistribution(bins) {
  const counts = new Map();
  for (const bin of bins) {
    for (const comic of bin.comics ?? []) {
      const grade = (comic.grade ?? '').toString().trim();
      if (!grade) continue;
      counts.set(grade, (counts.get(grade) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([grade, count]) => ({ grade, count }))
    .sort((a, b) => Number(b.grade) - Number(a.grade));
}

/** Comic count and total value per bin, for comparing bins against each other. */
export function valueByBin(bins) {
  return bins.map((bin) => {
    const comics = bin.comics ?? [];
    return {
      bin: bin.bin,
      count: comics.length,
      value: comics.reduce((sum, c) => sum + (fmvValue(c) ?? 0), 0),
      priced: comics.filter((c) => fmvValue(c) !== null).length,
    };
  });
}

/** US dollars, no cents — FMV is never precise enough for cents to mean anything. */
export function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

/**
 * Flatten every bin into one searchable list, so scanning any code — or just
 * visiting the site — can answer "which bin is this book in?".
 */
export function collectSearchIndex(bins) {
  const index = [];
  for (const bin of bins) {
    for (const comic of bin.comics ?? []) {
      index.push({
        cert: comic.cert,
        title: displayTitle(comic),
        bin: bin.bin,
        grade: comic.grade ?? '',
        publisher: comic.publisher ?? '',
        year: comic.issueYear ?? '',
      });
    }
  }
  return index;
}
