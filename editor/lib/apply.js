/**
 * The one implementation of "set a hand-entered value on a comic".
 *
 * Lives here, under the deployable editor, and is imported by BOTH the local
 * editor (src/editor.js) and the hosted one (editor/api/value.js). Two copies of
 * this rule would drift, and the rule matters: it decides when an estimate is
 * stored, cleared, or refused.
 */

/**
 * Apply one edit to an in-memory bin document.
 *
 * A blank or unparseable value clears the estimate rather than storing zero — a
 * book worth nothing and a book you have not valued are different facts. The
 * market figure in `fmv` is never touched; an override sits beside it, not on it.
 *
 * @param {{file: string, data: object}[]} bins
 * @returns {{file: string, data: object, comic: object}}
 */
export function applyEdit(bins, { cert, value, note }) {
  for (const { file, data } of bins) {
    const comic = (data.comics ?? []).find((c) => c.cert === String(cert));
    if (!comic) continue;

    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
    const clear = value === '' || value === null || !Number.isFinite(parsed);

    if (clear && !String(note ?? '').trim()) {
      delete comic.manual;
    } else {
      comic.manual = {
        ...(clear ? {} : { value: parsed }),
        ...(String(note ?? '').trim() ? { note: String(note).trim() } : {}),
        setAt: new Date().toISOString(),
      };
    }
    return { file, data, comic };
  }
  throw new Error(`unknown cert ${cert}`);
}
