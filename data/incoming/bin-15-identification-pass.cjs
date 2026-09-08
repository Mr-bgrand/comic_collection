// Proposed identities for the raw scans in bin 15 - a visual pass over the
// covers, written into each record's `identification` slot only.
//
//   NODE_PATH=./node_modules node data/incoming/bin-15-identification-pass.cjs <dir-for-review-sheet>
//
// Idempotent: re-running restores proposals if the bin file is overwritten
// (it was, twice, by a scanner started before merge-on-save landed), never
// touches a record already marked confirmed, and never sets title/issue/variant
// on the record itself. Confirming is the owner's step.
const fs = require('fs');
const path = require('path');

const V = 'visual';   // read off the cover by eye
const H = 'hash';     // matched to a known cover by perceptual hash

const book = (title, issue, variant, publisher, confidence, note) =>
  ({ title, issue, variant, publisher, confidence, source: V, ...(note ? { note } : {}) });

const SY = 'Skottie Young "Big Marvels" variant';
const MOMOKO_GS = book('Spider-Gwen: The Ghost-Spider', '1', 'Peach Momoko variant (with logo)', 'Marvel', 'high',
  'Your graded copy 4471692008 is the virgin of this cover');
const KOBE = book('Tribute: Kobe Bryant', '1', 'Black Mamba basketball cover', 'TidalWave', 'medium',
  'Same publisher/series as the wall copy 4526002009; exact edition unverified');
const DEVILS_CUT_A = book("D: The Devil's Cut", '1', 'skull / white cover', 'DSTLRY', 'high', 'issue assumed #1 - one-shot anthology');
const GONE_FOREST = book('Gone', null, 'Jock cover - dark forest', 'DSTLRY', 'medium', 'issue number not visible on cover');

/** id -> proposal. `books` = a merged bed holding two books, left then right. */
const P = {
  '001': { candidates: [book('Marvel Super Heroes Secret Wars', '8', 'Facsimile - virgin variant', 'Marvel', 'medium',
             'Same art as 015-005, which carries the Secret Wars #8 trade dress')], duplicateOf: 'raw:15-005' },
  '002': { candidates: [book('Orbit: Eminem', '1', null, 'TidalWave', 'high')] },
  '003': { candidates: [book('Spider-Man: Reign 2', '1', 'Skottie Young variant (Santa Spider-Man)', 'Marvel', 'high')] },
  '004': { candidates: [book('Spider-Man: Reign 2', '1', 'variant - aged Peter Parker face', 'Marvel', 'high', 'artist unverified')] },
  '005': { candidates: [book('Marvel Super Heroes Secret Wars', '8', 'Facsimile - variant with trade dress', 'Marvel', 'high')] },
  '006': { candidates: [MOMOKO_GS], duplicateOf: 'raw:15-011' },
  '007': { books: [
    book('Space Ghost', '1', 'variant - photo/figure cover', 'Dynamite', 'medium'),
    book('Spider-Man: Reign 2', '1', 'Kaare Andrews cover', 'Marvel', 'high') ] },
  '008': { candidates: [MOMOKO_GS], duplicateOf: 'raw:15-011' },
  '009': { candidates: [{ ...book('NYX', '1', 'Artgerm variant', 'Marvel', 'high'), source: H,
             note: 'Hash match (distance 8) to your Authority sleeve 1787185948, NYX #1 Artgerm' }] },
  '010': { candidates: [book('Spider-Gwen: The Ghost-Spider', '1', 'variant - Gwen with headphones and phone', 'Marvel', 'medium', 'artist unverified')] },
  '011': { candidates: [MOMOKO_GS] },
  '012': { candidates: [KOBE], duplicateOf: 'raw:15-013' },
  '013': { candidates: [KOBE] },
  '014': { candidates: [book('Tribute: Tupac Shakur', '1', '"All Eyes On Me" cover', 'TidalWave', 'high')] },
  '015': { candidates: [KOBE], duplicateOf: 'raw:15-013' },
  '016': { books: [
    book('Teenage Mutant Ninja Turtles', '1', 'IDW 25 Years - Jason Aaron / Joelle Jones', 'IDW', 'high'),
    book(null, null, 'Marvel Stormbreakers variant - Federico Vicentini', 'Marvel', 'low', 'host title not visible') ] },
  '017': { books: [
    book(null, null, 'Chicago Bulls tribute cover (Jordan / Pippen / Rodman)', 'TidalWave?', 'low'),
    book(null, null, '"Sports Almanac 1950-2000" cover (Back to the Future homage)', null, 'low') ] },
  '018': { books: [
    book(null, null, 'yellow skull figure in space - unknown', null, 'low'),
    book(null, null, 'battle scene - unknown', null, 'low') ] },
  '019': { candidates: [DEVILS_CUT_A], duplicateOf: 'raw:15-023' },
  '020': { candidates: [GONE_FOREST], duplicateOf: 'raw:15-024' },
  '021': { candidates: [book("D: The Devil's Cut", '1', 'red D variant', 'DSTLRY', 'high')] },
  '022': { candidates: [book('Gone', '1', 'Jock cover - eyes, "Nothing is farther away than home"', 'DSTLRY', 'medium')] },
  '023': { candidates: [DEVILS_CUT_A] },
  '024': { candidates: [GONE_FOREST] },
  '025': { books: [
    book('Female Force: Taylor Swift', null, 'standard cover', 'TidalWave', 'medium'),
    book('Spider-Gwen: The Ghost-Spider', '1', 'variant - Gwen with headphones and phone', 'Marvel', 'medium') ] },
  '026': { candidates: [book('Miles Morales: Spider-Man', '21', SY, 'Marvel', 'high')] },
  '027': { candidates: [book('Midnight Sons: Blood Hunt', '2', SY, 'Marvel', 'high')] },
  '028': { books: [
    book('The Amazing Spider-Man', '51', SY, 'Marvel', 'high'),
    book('Vengeance of the Moon Knight', '6', SY, 'Marvel', 'high') ] },
  '029': { books: [
    book("X-Men '97", '4', SY, 'Marvel', 'high'),
    book('X-Men', '35', SY + ' (Cyclops)', 'Marvel', 'high') ] },
  '030': { books: [
    book('Carnage', '8', SY, 'Marvel', 'high'),
    book('Jackpot & Black Cat', '4', SY, 'Marvel', 'high') ] },
  '031': { candidates: [book('Thanos Annual', '1', SY, 'Marvel', 'high')] },
  '032': { candidates: [book('Black Widow & Hawkeye', '4', SY, 'Marvel', 'high')] },
  '033': { candidates: [book('What If...? Venom', '3', 'Peach Momoko variant', 'Marvel', 'high')] },
  '034': { candidates: [book(null, null, 'Disney100 "What If... Mickey and Friends became the newest Avengers?" (New Avengers #1 homage)', 'Marvel', 'low', 'host title/issue not on cover')] },
  '035': { candidates: [book(null, null, 'Disney100 "What If... Mickey was the Invincible Iron Man?"', 'Marvel', 'low', 'host title/issue not on cover')] },
  '036': { candidates: [book(null, null, 'Disney100 "What If... Mickey and Friends were Earth\'s Mightiest Heroes?" (Avengers homage)', 'Marvel', 'low', 'host title/issue not on cover')] },
  '037': { candidates: [book('Star Wars: Doctor Aphra', '30', "Peach Momoko Women's History Month variant", 'Marvel', 'high')] },
  '038': { candidates: [book('Spider-Boy', '4', "Marvel '97 variant (after Roger Cruz)", 'Marvel', 'high')] },
  '039': { books: [
    book('Spider-Boy', '1', 'variant - Spider-Man & Spider-Boy rooftop', 'Marvel', 'high'),
    book('Spider-Boy', '5', 'variant', 'Marvel', 'high') ] },
  '040': { books: [
    book('The Immortal Thor', '12', SY, 'Marvel', 'high'),
    book('Venom', '34', SY, 'Marvel', 'high') ] },
  '041': { books: [
    book('Wolverine', '1', 'Blood Hunt - ' + SY, 'Marvel', 'high'),
    book('X-Men: Blood Hunt - Jubilee', '1', SY, 'Marvel', 'high') ] },
  '042': { candidates: [book('Ghost Rider: Final Vengeance', '4', SY, 'Marvel', 'high')] },
  '043': { candidates: [book('The Amazing Spider-Man', '52', SY + ' (LGY #946)', 'Marvel', 'high')] },
  '044': { candidates: [book('Captain America', '10', SY + ' (LGY #760)', 'Marvel', 'high')] },
  '045': { candidates: [book('Captain Marvel', '9', SY + ' (LGY #159)', 'Marvel', 'high')] },
  '046': { candidates: [book('Doctor Strange', '16', SY + ' (LGY #442)', 'Marvel', 'high')] },
  '047': { candidates: [book('The Invincible Iron Man', '19', SY + ' (LGY #669)', 'Marvel', 'high')] },
  '048': { candidates: [book('Spider-Gwen: The Ghost-Spider', '3', SY + ' (LGY #63)', 'Marvel', 'high')] },
  '049': { candidates: [book('Daredevil', '10', SY + ' (LGY #672)', 'Marvel', 'high')] },
  '050': { candidates: [book('Scarlet Witch', '1', SY, 'Marvel', 'high')] },
  '051': { candidates: [book('Spider-Boy', '8', SY, 'Marvel', 'high')] },
  '052': { candidates: [book('The Incredible Hulk', '13', SY + ' (LGY #794)', 'Marvel', 'high')] },
  '053': { candidates: [book('Fantastic Four', '21', SY + ' (The Thing)', 'Marvel', 'high')] },
  '054': { candidates: [book('Spider-Boy', '4', 'variant - Spider-Boy on dark web', 'Marvel', 'high')] },
  '055': { candidates: [book('The Avengers', '15', SY + ' (Black Panther, LGY #781)', 'Marvel', 'high')] },
  '056': { books: [
    book('Spider-Boy', '1', 'cover A with "The Marvels" theatrical banner', 'Marvel', 'high'),
    book('Spider-Boy', '1', 'variant - Spider-Man and Spider-Boy on rooftop (colour)', 'Marvel', 'high') ] },
  '057': { candidates: [book('Spider-Boy', '1', 'variant - Spider-Man and Spider-Boy on rooftop (colour)', 'Marvel', 'high') ] },
  '058': { candidates: [book('Spider-Boy', '3', 'variant - Marvel Comics Presents homage (reading a comic)', 'Marvel', 'high')] },
  '059': { candidates: [book('Spider-Boy', null, 'San Diego Comic-Con holofoil exclusive - Golden Gate Bridge, signed', 'Marvel', 'medium', 'issue number not on cover')] },
  '060': { candidates: [book('Female Force: Taylor Swift', null, 'X montage cover', 'TidalWave', 'high')] },
  '061': { books: [
    book('Spider-Gwen Annual', '1', 'Contest of Chaos (2023)', 'Marvel', 'high'),
    book('Amazing Fantasy', '1000', null, 'Marvel', 'high') ] },
  '062': { candidates: [book('Tales of the Titans', '1', 'Starfire cover', 'DC', 'high')] },
  '063': { candidates: [book('Spawn', '350', 'variant - winged Spawn, dark (350th issue banner)', 'Image', 'high')] },
  '064': { candidates: [book('Spawn', '350', 'variant - Spawn with skulls and green flame', 'Image', 'high')] },
  '065': { candidates: [book('Spawn', '350', 'Todd McFarlane cover (signed in print "McFarlane + FCO")', 'Image', 'high')] },
  '066': { candidates: [book('Spawn', '350', 'variant - Spawn with dragon', 'Image', 'high')] },
  '067': { candidates: [book('Spawn', '350', 'variant - black silhouette on white', 'Image', 'high')] },
  '068': { candidates: [book('Space Ghost', '1', 'cover A', 'Dynamite', 'high')] },
  '069': { candidates: [book('Moon Man', '2', 'Kid Cudi Presents - cover A', 'Image', 'high')] },
  '070': { books: [
    book('Moon Man', null, 'variant - astronaut helmet portrait', 'Image', 'low', 'series inferred from art; issue not visible'),
    book('Moon Man', null, 'variant - floating astronaut', 'Image', 'low', 'series inferred from art; issue not visible') ] },
  '071': { candidates: [book('Moon Man', null, 'variant - wrecked trucks, spaceman below', 'Image', 'low', 'series inferred from art; issue not visible')] },
  '072': { candidates: [book('Free Comic Book Day 2023: Spider-Man / Venom', '1', null, 'Marvel', 'high')] },
  '073': { books: [
    book('Miles Morales: Spider-Man', '4', 'variant - black cover, red logo', 'Marvel', 'high'),
    book(null, '1', 'Disney100 "What If... Ms. Marvel inspired a generation of heroes?" (Donald Duck)', 'Marvel', 'low', 'host title not on cover - likely Ms. Marvel: The New Mutant #1') ] },
  '074': { books: [
    book(null, null, 'Disney100 "What If... Mickey was the Invincible Iron Man?"', 'Marvel', 'low', 'same cover as 015-035; host title not on cover'),
    book('Edge of Spider-Verse', '2', 'Disney100 "What If... Daisy was Ghost-Spider?" variant', 'Marvel', 'high') ] },
  '075': { candidates: [book('The Amazing Mary Jane', '1', 'J. Scott Campbell variant', 'Marvel', 'high')] },
  '076': { candidates: [book('The Amazing Spider-Man', '1', 'cover A - Romita Jr. (2022, LGY #895, 60 Years)', 'Marvel', 'high')] },
  '077': { books: [
    book('Miles Morales: Spider-Man', '4', 'variant - rain', 'Marvel', 'high'),
    book('Radioactive Spider-Gwen', '2', null, 'Marvel', 'high') ] },
  '078': { candidates: [book('The Amazing Spider-Man', '14', 'J. Scott Campbell variant', 'Marvel', 'high')] },
  '079': { candidates: [book('Spider-Man', '4', 'Classic Homage variant ("Spider-Man and Spider-Man... and now the Sandman", LGY #160)', 'Marvel', 'high')] },
};

const file = 'data/comics/comic-bin-15.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const now = new Date().toISOString();
let written = 0, skipped = 0, merged = 0;

for (const comic of data.comics) {
  const m = /^raw:15-(\d{3})$/.exec(comic.id ?? '');
  if (!m) continue;
  const p = P[m[1]];
  if (!p) { skipped++; continue; }
  if (comic.identification?.status === 'confirmed') { skipped++; continue; }
  const id = { proposedAt: now, proposedBy: 'claude-visual-pass' };
  if (p.books) {
    merged++;
    Object.assign(id, { status: 'needs-split',
      note: 'Bed held two books touching; this crop shows both. Re-split from the kept bed, then relabel each.',
      books: p.books.map((b, i) => ({ position: i === 0 ? 'left' : 'right', ...b })), candidates: [] });
  } else {
    Object.assign(id, { status: 'proposed', candidates: p.candidates });
    if (p.duplicateOf) id.duplicateOf = p.duplicateOf;
  }
  comic.identification = id;
  written++;
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
console.log(`proposals written: ${written} (${merged} merged beds flagged), untouched: ${skipped}`);

// Review sheet: every front with its proposal underneath.
(async () => {
  const sharp = require('sharp');
  const raws = data.comics.filter((c) => /^raw:15-/.test(c.id));
  const W = 330, H = 500, COLS = 5;
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const tiles = [];
  for (const [i, c] of raws.entries()) {
    const img = await sharp(fs.readFileSync(path.join('data/images', c.images.front)))
      .resize(W - 8, H - 96, { fit: 'contain', background: { r: 40, g: 40, b: 50 } }).toBuffer();
    const idn = c.identification ?? {};
    const lines = [];
    if (idn.status === 'needs-split') {
      lines.push(`${c.id}  -  TWO BOOKS (re-split)`);
      for (const b of idn.books) lines.push(`${b.position}: ${[b.title, b.issue && '#' + b.issue].filter(Boolean).join(' ') || '?'} - ${b.variant ?? ''}`.slice(0, 58));
    } else {
      const b = idn.candidates?.[0] ?? {};
      lines.push(`${c.id}  ${b.confidence ?? ''}${idn.duplicateOf ? '  dup of ' + idn.duplicateOf.slice(4) : ''}`);
      lines.push(([b.title, b.issue && '#' + b.issue].filter(Boolean).join(' ') || 'unknown').slice(0, 44));
      lines.push((b.variant ?? '').slice(0, 52));
    }
    const svg = `<svg width="${W}" height="90"><rect width="100%" height="100%" fill="#101014"/>` +
      lines.map((l, k) => `<text x="6" y="${18 + k * 20}" font-family="sans-serif" font-size="${k ? 12 : 13}" font-weight="${k ? 400 : 700}" fill="${k ? '#cfd0dc' : '#fff'}">${esc(l)}</text>`).join('') + '</svg>';
    const col = i % COLS, row = Math.floor(i / COLS);
    tiles.push({ input: img, left: col * W + 4, top: row * H + 2 },
               { input: Buffer.from(svg), left: col * W, top: row * H + H - 92 });
  }
  const rows = Math.ceil(raws.length / COLS);
  const out = path.join(process.argv[2], 'bin15-proposals.jpg');
  await sharp({ create: { width: COLS * W, height: rows * H, channels: 3, background: { r: 18, g: 18, b: 24 } } })
    .composite(tiles).jpeg({ quality: 86 }).toFile(out);
  console.log('review sheet:', out);
})();
