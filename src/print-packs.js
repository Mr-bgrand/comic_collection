import { PDFDocument } from 'pdf-lib';

export const PRINT_PACKS = ['all-case-labels-4x6.pdf', 'all-case-master-sheets-letter.pdf', 'collection-master-list.pdf'];
export const isPrintPdf = name => /^bin-[a-zA-Z0-9_-]+-(label|sheet)\.pdf$/.test(name) || PRINT_PACKS.includes(name);

export function printGuide(manifest) {
  const range = r => r.firstPage === r.lastPage ? String(r.firstPage) : `${r.firstPage}-${r.lastPage}`;
  const rows = manifest.labels.ranges.map((label,i) => {
    const sheet = manifest.sheets.ranges[i], name = (label.title || label.id).replace(/\|/g,'\\|');
    return `| ${name} | ${label.copies} | [${range(label)}](bin-${label.id}-label.pdf) | [${range(sheet)}](bin-${label.id}-sheet.pdf) | ${sheet.blankPage || '-'} |`;
  }).join('\n');
  return `# Current print set

Generated ${manifest.generatedAt.slice(0,10)} from the stored collection: **${manifest.objects} objects**, including **${manifest.physicalCopies} copies in ${manifest.physicalContainers} physical containers**.

| Complete PDF | Paper and settings |
| --- | --- |
| [All case labels](${PRINT_PACKS[0]}) | 4 x 6 inches; ${manifest.labels.pages} pages; single-sided; actual size / 100% |
| [All case master sheets](${PRINT_PACKS[1]}) | Letter portrait; ${manifest.sheets.pages} pages; double-sided, flip on long edge; actual size / 100% |
| [Collection master list](${PRINT_PACKS[2]}) | Letter landscape; all ${manifest.objects} stored copies, including external storage and unassigned cards |

The combined master sheets include blank reverse pages where needed so the next case starts on a new physical sheet. Keep those blanks when printing duplex. The individual PDFs below contain only that case's content pages. Labels for larger cases continue onto additional 4 x 6 pages.

Each label row includes the grading company beside the grade (for example, PSA 10, TAG 9, CGC 9.8 or CBCS 9.8). Arena Club is written in full. Ungraded comics show RAW; Authority-authenticated copies show Authority RAW.

Print the PDFs using actual size / 100%, not Fit or Shrink. These are ready-to-print files; generating them does not send a job to your printer. Cover scans and certification data come from the stored records. Missing scans and values stay missing; printing does not fetch new prices.

## Container index

Page numbers refer to the combined packs; links open the individual PDFs. Blank reverse pages apply only to the combined master-sheet pack.

| Container | Copies | Label pages | Master pages | Blank reverse |
| --- | ---: | --- | --- | ---: |
${rows}

## Refresh

Run \`npm run build\`, then \`npm run print\`. This refreshes every per-container PDF, all three combined/reference PDFs, this index and [manifest.json](manifest.json). In local Collection / Lab, **Admin > Print Studio > Build & generate** runs the same workflow and lists the PDFs.

Only physical containers receive labels. The complete master list also includes PSA Vault custody and cards without an assigned location. See [collection status](../docs/collection-status.md) for the dated inventory breakdown and unfinished intake.

Matching HTML files are kept for previews. The \`print/\` directory is committed; \`dist/\` is temporary build output. If an open PDF is locked by a Windows viewer, close that file and run \`npm run print\` again. Combined packs are refreshed only when every individual PDF succeeds.
`;
}

/** Retain exact page sizes. A case starts on a new sheet when printing duplex. */
export async function assemblePrintPack(entries, { title, duplex = false } = {}) {
  const output = await PDFDocument.create(), ranges = [];
  output.setTitle(title || 'Collection print pack');
  output.setCreator('Comic Collection');
  for (const entry of entries) {
    const source = await PDFDocument.load(entry.bytes);
    const firstPage = output.getPageCount() + 1;
    for (const page of await output.copyPages(source, source.getPageIndices())) output.addPage(page);
    const lastPage = output.getPageCount();
    let blankPage = null;
    if (duplex && output.getPageCount() % 2) {
      const { width, height } = source.getPage(0).getSize();
      output.addPage([width, height]);blankPage = output.getPageCount();
    }
    ranges.push({ id: entry.id, title: entry.title, copies: entry.copies, firstPage, lastPage, blankPage });
  }
  return { bytes: await output.save(), pages: output.getPageCount(), ranges };
}
