# Current print set

Generated 2026-09-10 from the stored collection: **933 objects**, including **884 copies in 20 physical containers**.

| Complete PDF | Paper and settings |
| --- | --- |
| [All case labels](all-case-labels-4x6.pdf) | 4 x 6 inches; 38 pages; single-sided; actual size / 100% |
| [All case master sheets](all-case-master-sheets-letter.pdf) | Letter portrait; 76 pages; double-sided, flip on long edge; actual size / 100% |
| [Collection master list](collection-master-list.pdf) | Letter landscape; all 933 stored copies, including external storage and unassigned cards |

The combined master sheets include blank reverse pages where needed so the next case starts on a new physical sheet. Keep those blanks when printing duplex. The individual PDFs below contain only that case's content pages. Labels for larger cases continue onto additional 4 x 6 pages.

Each label row includes the grading company beside the grade (for example, PSA 10, TAG 9, CGC 9.8 or CBCS 9.8). Arena Club is written in full. Ungraded comics show RAW; Authority-authenticated copies show Authority RAW.

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
| Bin 10 | 23 | [10](bin-10-label.pdf) | [19-20](bin-10-sheet.pdf) | - |
| Bin 11 | 25 | [11](bin-11-label.pdf) | [21-22](bin-11-sheet.pdf) | - |
| Display Wall | 5 | [12](bin-wall-label.pdf) | [23](bin-wall-sheet.pdf) | 24 |
| Case #1 | 26 | [13](bin-case-01-label.pdf) | [25-26](bin-case-01-sheet.pdf) | - |
| Case #2 | 57 | [14-16](bin-case-02-label.pdf) | [27-31](bin-case-02-sheet.pdf) | 32 |
| Graded PSA Case #3 | 94 | [17-20](bin-case-03-label.pdf) | [33-39](bin-case-03-sheet.pdf) | 40 |
| Case Wall Display (Office) | 11 | [21](bin-case-wall-office-label.pdf) | [41](bin-case-wall-office-sheet.pdf) | 42 |
| Comic Bin #13 (Softslabs) | 98 | [22-25](bin-comic-bin-13-label.pdf) | [43-49](bin-comic-bin-13-sheet.pdf) | 50 |
| Comic Bin #14 (Softslabs) | 97 | [26-29](bin-comic-bin-14-label.pdf) | [51-57](bin-comic-bin-14-sheet.pdf) | 58 |
| Comic Bin #15 (Softslabs) | 123 | [30-34](bin-comic-bin-15-label.pdf) | [59-67](bin-comic-bin-15-sheet.pdf) | 68 |
| Comic Case #12 (Softslabs) | 111 | [35-38](bin-comic-case-12-label.pdf) | [69-76](bin-comic-case-12-sheet.pdf) | - |

## Refresh

Run `npm run build`, then `npm run print`. This refreshes every per-container PDF, all three combined/reference PDFs, this index and [manifest.json](manifest.json). In local Collection / Lab, **Admin > Print Studio > Build & generate** runs the same workflow and lists the PDFs.

Only physical containers receive labels. The complete master list also includes PSA Vault custody and cards without an assigned location. See [collection status](../docs/collection-status.md) for the dated inventory breakdown and unfinished intake.

Matching HTML files are kept for previews. The `print/` directory is committed; `dist/` is temporary build output. If an open PDF is locked by a Windows viewer, close that file and run `npm run print` again. Combined packs are refreshed only when every individual PDF succeeds.
