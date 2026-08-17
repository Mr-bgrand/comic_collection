/**
 * Encoding repair for CGC cert records.
 *
 * CGC's own pages serve damaged bytes for non-ASCII characters — the live record
 * for cert 4395549004 reads "Gr<U+FFFD>nbekk" and "Ram<U+FFFD>n". The damage is in
 * their data, not in our extraction, so it has to be repaired on the way in.
 *
 * Two kinds of damage, handled differently:
 *
 *   1. UTF-8 read as Latin-1 ("GrÃ¸nbekk"). Lossless — the original bytes are all
 *      still there, so it is decoded back mechanically. No guessing.
 *   2. U+FFFD replacement characters ("Gr?nbekk"). Lossy — the original byte is
 *      gone for good. Recovery is only possible by recognising the damaged name,
 *      so it is table-driven and anything unrecognised is reported, never guessed.
 */

const FFFD = '�';

/**
 * Correctly-spelled names that have shown up damaged in CGC records, or are
 * likely to. The damaged form is derived from these, so adding a name here is
 * the only step needed to teach the repairer a new one.
 */
export const KNOWN_NAMES = [
  // Confirmed damaged in live CGC data
  'Grønbekk', 'Ramón',
  // Frequent comics credits with non-ASCII characters
  'Pérez', 'Rodríguez', 'Gómez', 'Hernández', 'Sánchez', 'Fernández',
  'Martínez', 'Ramírez', 'Álvarez', 'Díaz', 'Núñez', 'Jiménez',
  'Ibáñez', 'Muñoz', 'Vázquez', 'Domínguez', 'Peña', 'Ríos',
  'José', 'Martín', 'Adrián', 'Andrés', 'Jesús', 'Óscar', 'Rubén',
  'Joaquín', 'Sebastián', 'Tomás', 'Ángel', 'Iván', 'Aarón',
  'Frédéric', 'Jérôme', 'André', 'Noël', 'Loïc', 'Zoé',
  'Müller', 'Schäfer', 'Jürgen', 'Björn', 'Söderberg',
  'Bjørn', 'Søren', 'Håkan', 'Åsa', 'Niccolò',
];

const damagedForm = (s) => s.replace(/[^\x00-\x7F]/g, FFFD);

/**
 * Two names can collapse to the same damaged form ("Pérez" and "Pèrez" both
 * become "P?rez"). Those are dropped from the table — an ambiguous repair is
 * reported as unresolved rather than guessed at.
 */
function buildTable(names) {
  const table = new Map();
  const ambiguous = new Set();
  for (const name of names) {
    const damaged = damagedForm(name);
    if (damaged === name) continue; // pure ASCII, nothing to repair
    if (table.has(damaged) && table.get(damaged) !== name) ambiguous.add(damaged);
    else table.set(damaged, name);
  }
  for (const d of ambiguous) table.delete(d);
  return table;
}

const TABLE = buildTable(KNOWN_NAMES);

/**
 * Reverse a UTF-8-read-as-Latin-1 mangling. Lossless and mechanical: the string
 * is reinterpreted as the byte sequence it actually is. Returns the input
 * unchanged unless it genuinely looks mangled, so clean text is never touched.
 */
function looksMojibake(s) {
  // A UTF-8 lead byte (0xC2-0xF4) followed by a continuation byte (0x80-0xBF),
  // both sitting in the string as individual characters. Expressed with char
  // codes rather than a regex so no escaping can quietly corrupt the range.
  for (let i = 0; i < s.length - 1; i += 1) {
    const lead = s.charCodeAt(i);
    const next = s.charCodeAt(i + 1);
    if (lead >= 0xc2 && lead <= 0xf4 && next >= 0x80 && next <= 0xbf) return true;
  }
  return false;
}

export function fixMojibake(s) {
  if (typeof s !== 'string' || s === '') return s;
  if (!looksMojibake(s)) return s;
  for (const ch of s) if (ch.codePointAt(0) > 0xff) return s; // not a byte string
  const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return s; // not valid UTF-8 after all — leave it alone
  }
}

/**
 * Repair one text field.
 * @returns {{text: string, repairs: [string, string][], unresolved: string[]}}
 */
export function repairText(input) {
  if (typeof input !== 'string' || input === '') {
    return { text: input ?? '', repairs: [], unresolved: [] };
  }

  let text = fixMojibake(input);
  const repairs = [];

  if (text.includes(FFFD)) {
    for (const [damaged, correct] of TABLE) {
      if (text.includes(damaged)) {
        text = text.split(damaged).join(correct);
        repairs.push([damaged, correct]);
      }
    }
  }

  // Whatever damage is left could not be repaired confidently. Report it and
  // leave the text verbatim — a warning beats a wrong name on an appraisal doc.
  const unresolved = text.includes(FFFD)
    ? [...new Set(text.split(/\s+/).filter((w) => w.includes(FFFD)))]
    : [];

  return { text, repairs, unresolved };
}

const TEXT_FIELDS = [
  'title', 'variant', 'publisher', 'artComments',
  'keyComments', 'labelCategory', 'issueDate',
];

/**
 * Repair every text field of a cert record, recording what was changed so the
 * edit is auditable against the CGC page. Does not mutate the input.
 */
export function repairRecord(record) {
  const out = { ...record };
  const repairs = [];
  const unresolved = [];

  for (const field of TEXT_FIELDS) {
    if (typeof out[field] !== 'string') continue;
    const result = repairText(out[field]);
    out[field] = result.text;
    repairs.push(...result.repairs);
    unresolved.push(...result.unresolved);
  }

  const seen = new Set();
  out.repairs = repairs.filter(([damaged]) => {
    if (seen.has(damaged)) return false;
    seen.add(damaged);
    return true;
  });

  if (unresolved.length) out.unresolved = [...new Set(unresolved)];
  return out;
}
