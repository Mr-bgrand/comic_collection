# Current print set

Generated 2026-09-08 from the stored collection: **910 objects**, including **847 copies in 19 physical containers**.

| Complete PDF | Paper and settings |
| --- | --- |
| [All case labels](all-case-labels-4x6.pdf) | 4 x 6 inches; 37 pages; single-sided; actual size / 100% |
| [All case master sheets](all-case-master-sheets-letter.pdf) | Letter portrait; 74 pages; double-sided, flip on long edge; actual size / 100% |
| [Collection master list](collection-master-list.pdf) | Letter landscape; all 910 stored copies, including external storage and unassigned cards |

The combined master sheets include blank reverse pages where needed so the next case starts on a new physical sheet. Keep those blanks when printing duplex. The individual PDFs below contain only that case's content pages. Labels for larger cases continue onto additional 4 x 6 pages.

Print the PDFs using actual size / 100%, not Fit or Shrink. These are ready-to-print files; generating them does not send a job to your printer. Cover scans and certification data come from the stored records. Missing scans and values stay missing; printing does not fetch new prices.

## Container index

Page numbers refer to the combined packs; links open the individual PDFs. Blank reverse pages apply only to the combined master-sheet pack.

| Container | Copies | Label pages | Master pages | Blank reverse |
| --- | ---: | --- | --- | ---: |
| Bin 01 | 23 | [1](bin-01-label.pdf) | [1-2](bin-01-sheet.pdf) | - |
| Bin 02 | 23 | [2](bin-02-label.pdf) | [3-4](bin-02-sheet.pdf) | - |
| Bin 03 | 25 | [3](bin-03-label.pdf) | [5-6](bin-03-sheet.pdf) | - |
| Bin 04 | 23 | [4](bin-04-label.pdf) | [7-8](bin-04-sheet.pdf) | - |
| Bin 05 | 25 | [5](bin-05-label.pdf) | [9-10](bin-05-sheet.pdf) | - |
| Bin 06 | 25 | [6](bin-06-label.pdf) | [11-12](bin-06-sheet.pdf) | - |
| Bin 07 | 24 | [7](bin-07-label.pdf) | [13-14](bin-07-sheet.pdf) | - |
| Bin 08 | 22 | [8](bin-08-label.pdf) | [15-16](bin-08-sheet.pdf) | - |
| Bin 09 | 24 | [9](bin-09-label.pdf) | [17-18](bin-09-sheet.pdf) | - |
| Bin 11 | 25 | [10](bin-11-label.pdf) | [19-20](bin-11-sheet.pdf) | - |
| Display Wall | 5 | [11](bin-wall-label.pdf) | [21](bin-wall-sheet.pdf) | 22 |
| Case #1 | 12 | [12](bin-case-01-label.pdf) | [23](bin-case-01-sheet.pdf) | 24 |
| Case #2 | 57 | [13-15](bin-case-02-label.pdf) | [25-29](bin-case-02-sheet.pdf) | 30 |
| Graded PSA Case #3 | 94 | [16-19](bin-case-03-label.pdf) | [31-37](bin-case-03-sheet.pdf) | 38 |
| Case Wall Display (Office) | 11 | [20](bin-case-wall-office-label.pdf) | [39](bin-case-wall-office-sheet.pdf) | 40 |
| Comic Bin #13 (Softslabs) | 98 | [21-24](bin-comic-bin-13-label.pdf) | [41-47](bin-comic-bin-13-sheet.pdf) | 48 |
| Comic Bin #14 (Softslabs) | 97 | [25-28](bin-comic-bin-14-label.pdf) | [49-55](bin-comic-bin-14-sheet.pdf) | 56 |
| Comic Bin #15 (Softslabs) | 123 | [29-33](bin-comic-bin-15-label.pdf) | [57-65](bin-comic-bin-15-sheet.pdf) | 66 |
| Comic Case #12 (Softslabs) | 111 | [34-37](bin-comic-case-12-label.pdf) | [67-74](bin-comic-case-12-sheet.pdf) | - |

## Refresh

Run `npm run build`, then `npm run print`. This refreshes every per-container PDF, all three combined/reference PDFs, this index and [manifest.json](manifest.json). In local Collection / Lab, **Admin > Print Studio > Build & generate** runs the same workflow and lists the PDFs.

Only physical containers receive labels. The complete master list also includes PSA Vault custody and cards without an assigned location. See [collection status](../docs/collection-status.md) for the dated inventory breakdown and unfinished intake.

Matching HTML files are kept for previews. The `print/` directory is committed; `dist/` is temporary build output. If an open PDF is locked by a Windows viewer, close that file and run `npm run print` again. Combined packs are refreshed only when every individual PDF succeeds.
