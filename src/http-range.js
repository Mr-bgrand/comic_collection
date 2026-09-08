/** A single HTTP byte range, including open-ended and suffix requests from media players. */
export function mediaRange(header, length) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!match || (!match[1] && !match[2]) || !length) return null;
  const first = match[1] ? Number(match[1]) : null, last = match[2] ? Number(match[2]) : null;
  if ([first,last].some(n => n !== null && !Number.isSafeInteger(n))) return null;
  const start = first ?? Math.max(0, length - last), end = first === null || last === null ? length - 1 : Math.min(last, length - 1);
  return start < 0 || start >= length || end < start ? null : { start, end };
}
