/**
 * Telling near-identical variants apart.
 *
 * Half this collection shares a title and issue number with something else, and
 * the differences are the kind a search engine flattens: "Comic Mint Edition"
 * against "Comic Mint \"Virgin\" Edition A"; the same "Near Mint Comics Edition"
 * at 8.0 and at 9.4; and Moon Man #1 six times over, one of which has no variant
 * string at all.
 *
 * That last case is the hard one. The base issue's search terms are a strict
 * subset of every sibling's, so no query can prefer it — the only way to exclude
 * the variants is to name them and search against them. So this module produces
 * what a lookup tool actually needs: the sibling certs, the words that belong to
 * the siblings and not to this book, and an honest verdict on whether text can
 * separate them at all.
 */

/** Words that appear in nearly every variant string and distinguish nothing. */
/*
 * Single letters are deliberately absent here. "Edition A" and "Cover B" are
 * designators, not articles, and dropping "a" while keeping "b" made two
 * identical situations behave differently. They are kept as tokens and filtered
 * later by length, so every single-character designator is treated the same way:
 * meaningful to a human, unusable in a query.
 */
const FILLER = new Set([
  'edition', 'variant', 'cover', 'comics', 'comic', 'the', 'of', 'and',
  'printing', 'exclusive', 'virgin', 'foil', 'set',
]);

const norm = (s) => String(s ?? '').toLowerCase().replace(/["'.,]/g, ' ').replace(/\s+/g, ' ').trim();

/** Group key: two books collide when they are the same title and issue. */
export function groupKey(comic) {
  return `${norm(comic.title)}#${norm(comic.issue)}`;
}

/**
 * The words in a variant string that actually identify it.
 * Single characters survive here (Cover B vs Cover C) because they matter to a
 * human even though they are useless to a search engine — `matchDifficulty`
 * is what reports that they cannot be searched on.
 */
export function variantTokens(variant) {
  return norm(variant)
    .split(' ')
    .filter((w) => w && !FILLER.has(w));
}

/** Tokens long enough to be worth putting in a query. */
const searchable = (tokens) => tokens.filter((t) => t.length >= 3 && !/^\d+$/.test(t));

/**
 * How hard it is to pick this book out from its siblings using text alone.
 *
 *   unique  nothing else shares its title and issue
 *   text    it has searchable words no sibling has
 *   visual  it does not — the cover image or the cert is the only discriminator
 *
 * "visual" is not a failure. It is the difference between a tool returning a
 * confident wrong answer and returning nothing, which is the whole point.
 */
export function matchDifficulty(comic, siblings) {
  if (!siblings.length) return 'unique';

  const mine = new Set(searchable(variantTokens(comic.variant)));
  if (!mine.size) return 'visual'; // base issue, or variant made only of filler

  const theirs = new Set();
  for (const s of siblings) for (const t of searchable(variantTokens(s.variant))) theirs.add(t);

  for (const t of mine) if (!theirs.has(t)) return 'text';
  return 'visual';
}

/**
 * Words belonging to the siblings but not to this book — terms a query should
 * exclude. For a base issue with variant siblings this is the only thing that
 * can separate them.
 */
export function excludeTerms(comic, siblings) {
  const mine = new Set(variantTokens(comic.variant));
  const out = new Set();
  for (const s of siblings) {
    for (const t of searchable(variantTokens(s.variant))) {
      if (!mine.has(t)) out.add(t);
    }
  }
  return [...out].sort();
}

/**
 * Index a whole collection: for every comic, who it can be confused with.
 * @param {{comic: object, bin: string}[]} entries
 */
export function buildVariantIndex(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const k = groupKey(entry.comic);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(entry);
  }

  const index = new Map();
  for (const members of groups.values()) {
    for (const { comic } of members) {
      const siblings = members.filter((m) => m.comic.cert !== comic.cert).map((m) => m.comic);
      index.set(comic.cert, {
        groupSize: members.length,
        siblingCerts: siblings.map((s) => s.cert),
        excludeTerms: excludeTerms(comic, siblings),
        difficulty: matchDifficulty(comic, siblings),
      });
    }
  }
  return index;
}
