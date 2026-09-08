/** Owner policy: an unpriced TAG copy may use the same card at the same PSA grade. */
const knownValue = entry => typeof entry?.value === 'number' && Number.isFinite(entry.value);
const normalize = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const gradeOf = card => /^(?:10|[1-9](?:\.5)?)$/.test(String(card?.grade)) ? Number(card.grade) : null;

/** Deliberately conservative: no fuzzy subjects, parallel aliases, or grade rounding. */
export function cardIdentityKey(card) {
  if (card?.kind !== 'card' || !/^\d{4}$/.test(String(card.year)) || !card.subject || !card.brand || !card.cardNumber) return null;
  const product = normalize([card.brand, card.series].filter(Boolean).join(' '));
  const pokemon = /\bPOKEMON\b/.test(product);
  const language = normalize(card.language) || product.match(/\b(JAPANESE|KOREAN|FRENCH|GERMAN|SPANISH|ITALIAN|CHINESE|INDONESIAN|PORTUGUESE)\b/)?.[1] || (pokemon ? 'ENGLISH' : 'UNSPECIFIED');
  // PSA's modern English Pokémon set prefix, e.g. POKEMON OBF EN-OBSIDIAN FLAMES.
  const brand = normalize(card.brand).replace(/^POKEMON [A-Z0-9]+ EN /, '');
  const number = normalize(String(card.cardNumber).split('/')[0]).replace(/^0+(?=\d)/, '');
  return JSON.stringify([String(card.year), pokemon ? 'POKEMON' : 'CARD', language, brand, normalize(card.subject), number, normalize(card.variety), normalize(card.qualifiers)]);
}

function officialPsaUrl(url, cert) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && ['www.psacard.com', 'psacard.com'].includes(parsed.hostname) && new RegExp(`^/cert/${cert}(?:/psa)?/?$`).test(parsed.pathname); }
  catch { return false; }
}

export function comparisonForTag(card, candidates) {
  const identityKey = cardIdentityKey(card), grade = gradeOf(card);
  if (card?.grader !== 'TAG' || identityKey === null || grade === null) return null;
  const matches = candidates.filter(psa => psa.grader === 'PSA' && /^\d+$/.test(psa.cert) && gradeOf(psa) === grade && cardIdentityKey(psa) === identityKey && knownValue(psa.fmv) && psa.fmv.value >= 0 && psa.fmv.currency === 'USD' && ['psa-cert-page', 'psa-vault-export'].includes(psa.fmv.source) && officialPsaUrl(psa.fmv.url, psa.cert));
  // Prefer the latest dated observation; differing prices on the same date need review.
  const date = psa => psa.fmv.asOf || psa.fmv.fetchedAt || '';
  matches.sort((a, b) => date(b).localeCompare(date(a)) || a.cert.localeCompare(b.cert));
  const psa = matches[0];
  if (!psa || matches.some(other => date(other) === date(psa) && other.fmv.value !== psa.fmv.value)) return null;
  return {
    value: psa.fmv.value, currency: 'USD', source: 'psa-grade-comparison', status: 'recorded',
    asOf: date(psa) || null, url: psa.fmv.url,
    comparison: { grader: 'PSA', cert: psa.cert, grade: String(psa.grade), identityKey, tagCert: card.cert, source: psa.fmv.source },
  };
}

/** Direct grader data and explicit owner estimates take priority over comparisons. */
export function marketValuation(card) {
  if (knownValue(card?.fmv)) return card.fmv;
  if (knownValue(card?.manual)) return null;
  const value = card?.psaComparison, comparison = value?.comparison;
  if (card?.kind !== 'card' || card.grader !== 'TAG' || !knownValue(value) || value.value < 0 || value.currency !== 'USD' || value.source !== 'psa-grade-comparison') return null;
  if (!comparison || comparison.grader !== 'PSA' || comparison.tagCert !== card.cert || !/^\d+$/.test(comparison.cert) || gradeOf(card) === null || gradeOf(comparison) !== gradeOf(card) || !cardIdentityKey(card) || comparison.identityKey !== cardIdentityKey(card) || !officialPsaUrl(value.url, comparison.cert)) return null;
  return value;
}

export function marketValueLabel(card) {
  const value = marketValuation(card);
  if (!value) return null;
  if (value.source === 'psa-grade-comparison') return `PSA ${value.comparison.grade} comparison · TAG fallback`;
  if (card.kind === 'card') return value.source === 'psa-vault-export' ? 'PSA estimate · vault export' : `${card.grader || 'Card'} estimate`;
  return 'GoCollect FMV';
}
