/** Search and discovery share one matcher so shortcut counts equal their results. */
export function normalizeSearch(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
    .replace(/\bspiderman\b/g, 'spider man').replace(/\bspidergwen\b/g, 'spider gwen')
    .replace(/\bxmen\b/g, 'x men');
}

export function matchesSearch(record, query, {unvaluedOnly=false}={}) {
  if(unvaluedOnly&&typeof record.value==='number'&&Number.isFinite(record.value))return false;
  const needle = normalizeSearch(query);
  if (!needle) return true;
  if (['tag', 'psa', 'cgc', 'cbcs', 'authority'].includes(needle)) {
    const issuer = record.provider || record.grader || String(record.grade || '').split(' ')[0];
    return normalizeSearch(issuer) === needle;
  }
  return normalizeSearch([record.title, record.short, record.variant, record.cert,
    record.grade, record.container, record.publisher, record.year, record.searchTerms].filter(Boolean).join(' ')).includes(needle);
}

// Labels group names already present in metadata; they never assert who is pictured.
const comicNames = [
  'Spider-Man', 'Miles Morales', 'Spider-Gwen', 'Spider-Boy', 'Venom', 'Batman',
  'Harley Quinn', 'Hulk', 'Wolverine', 'X-Men', 'Ghost Rider', 'Deadpool', 'Catwoman',
  'Supergirl', 'Wonder Woman', 'Moon Man', 'Silver Surfer', 'Superman', 'Obi-Wan Kenobi',
  'Darth Vader', 'Gwen Stacy', 'Captain America', 'Thor', 'Iron Man', 'Black Panther',
];
const keywordLabels = ['Foil', 'Virgin', 'Sketch', 'Signed', 'Facsimile', 'Pokémon',
  'Star Wars', 'One Piece', 'Momoko', 'Gleason', 'First appearance'];
const nameCase = value => value.toLowerCase().replace(/(^|[\s.-])([a-z])/g, (_, space, letter) => space + letter.toUpperCase());

export function searchShortcuts(records, {nameLimit = 8, keywordLimit = 6} = {}) {
  const names = [...comicNames];
  for (const record of records) {
    names.push(...(record.featuredCharacters || []));
    if (record.kind !== 'card' || !record.short) continue;
    const label = nameCase(record.short.replace(/^FULL ART\//i, '')
      .replace(/(?:\s+(?:EX|GX|VSTAR|VMAX)|-HOLO)$/i, ''));
    if (label.length <= 32) names.push(label);
  }
  function rank(labels, limit) {
    const unique = new Map(labels.map(label => [normalizeSearch(label), label]));
    return [...unique].map(([query, label]) => ({label, query,
      count: records.filter(record => matchesSearch(record, query)).length}))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en'))
      .slice(0, limit);
  }
  return {names: rank(names, nameLimit), keywords: rank(keywordLabels, keywordLimit)};
}
