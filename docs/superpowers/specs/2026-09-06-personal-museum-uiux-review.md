# The Collection: a personal museum

**Superseded visual direction:** The owner rejected the conventional website framing and the “Family guide” label. Use [Collection / Lab](2026-09-06-collection-engine-direction.md) for the active experience direction. The repository, branch, and inventory findings below remain historical review evidence.

Date: 2026-09-06. Status: UI/UX review and interactive concept; proposed product direction, not a production migration.

The strongest direction is a personal museum: the pleasure of holding a remarkable object, the story of why it belongs here, and a record someone else can understand. The existing longbox experience is the right starting point. A beautiful entrance, an exact item record, and an approachable family guide can make it feel like one collection rather than several utilities.

## What I reviewed

- Both specs in this directory: the original inventory/label design and the draft PSA/TAG cards design.
- Current main at `79ce2e7`, after fetching origin; existing local inventory and scan changes were included in the data snapshot.
- `origin/claude/comic-wall-enhancements-dim872` at `8d30c3e`. Its work is already an ancestor of main. Main is 16 commits ahead; that branch contains no additional changes to merge.
- Home, dashboard, bin pages, wall, WebGL vault and longbox presentation; data/model/build, scan and price workflow documentation; separate hosted editor documentation.
- Rendered desktop screens and a 390px phone viewport. This was a focused browser/source review, not a complete accessibility, security or real-device performance audit. The editor deployment and live grading services were not exercised.
- Existing test suite: 217 passed, zero failed.

The original spec is historical: it explicitly excludes valuation, non-CGC books and web editing, while the implementation now has GoCollect/manual values, CBCS records and local/hosted editors. The cards spec is still a proposal: there is no implemented `data/cards` collection or PSA/TAG command in this checkout.

## The collection today

| Recorded fact | Snapshot |
| --- | --- |
| Comics | 244: 242 CGC and 2 CBCS |
| Containers | 10 storage bins and one display wall |
| Front / back image references | 239 / 236 records |
| Recorded GoCollect subtotal | $11,483 across 163 comics |
| Without a market value | 81: 40 listed without recorded sales, 39 counted as not listed, 2 not fetched |
| Owner estimates currently entered | 0 |
| Stored top-pop flags | 131 of 244, about 54% |
| Room/shelf location for storage bins | Blank for all ten |

These are sums and counts from the current JSON, not a fresh appraisal or live price lookup. Image counts indicate recorded references, not a certification of every scan's quality. The subtotal excludes 81 items. “Top pop” means no higher grade in the stored census; it does not establish scarcity, demand or value.

## What is already working well

**Physical and digital records are connected.** A bin label, its QR destination, the print manifest and committed scans already form a durable chain. Preserve the existing bin URLs so old printed QR codes continue to work.

**The longbox is personal.** A row represents a real bin, and lifting/riffling a slab resembles the physical experience. This is a more distinctive foundation than a generic analytics dashboard.

**The data has useful integrity rules.** Exact variant strings, grader links, encoding repair history, separate manual estimates and image ownership checks matter when somebody must identify a copy years later. Preserve those boundaries in a redesign.

**There are practical fallback paths.** The flat wall and static records remain available when the WebGL view cannot run. Existing thumbnail derivatives and reduced-motion work show care for real devices.

## Findings, in priority order

| Priority | Finding and evidence | Proposed change |
| --- | --- | --- |
| P1 | The dashboard's back link resolves to itself. Browser-confirmed; `src/templates/dashboard.js:533` uses `href="./"` from `/dashboard/`. | Use the correct root destination and a shared navigation component. Add a route-level link check. |
| P1 | Selecting an exact comic loses that selection: home search and the walls link to the bin, whose articles have no item ID. See `indexPage.js:173`, `binPage.js:218`, and `wall3dPage.js:1116`. | Give each item a stable grader-plus-cert identity and URL. As a small first step, link to a cert anchor in the bin. Preserve focus and search/sort state on return. |
| P1 | An owner estimate is omitted from the QR bin record, and the walls combine FMV/manual values without carrying source/date. The dashboard handles estimates more clearly. See `binPage.js:190`, `wallPage.js:682`, `wall3dPage.js:1095`. No manual values exist in today's data, so this is a latent cross-page inconsistency. | One shared value presentation: amount, source, observation date and missing-state explanation. Use it in gallery, item, bin, print and family views. |
| P1 | Family members can identify a bin number, but no storage bin records a room or shelf. | A one-time owner setup: container name, room, shelf, optional photo. Public/private storage rules must be settled before publishing detailed locations. |
| P2 | Mobile CSS hides the entire money block, including bin location, in both wall readouts (`wallPage.js:453`, `wall3dPage.js:355`). | Make location and value evidence visible in a sheet below the selected object; keep 44px actions. |
| P2 | The 244-cover wall is visually rich, but the entrance is a text list of bins. Cover art and collection personality arrive only after a navigation choice. | Open with a small, curated shelf. Offer exhibits, search and family guide as deliberate entry points. |
| P2 | Dashboard charts precede the inventory; sorting is wired only to clicks on non-focusable table headers (`dashboard.js:384`). | Provide search and useful filters before the long table. Use real buttons inside headers, keyboard sorting and `aria-sort`. |
| P2 | The UI calls the display wall “Bin wall” instead of using its existing title. The card proposal will add another different container type. | Adopt container presentation with a human name and type: storage bin, display wall, card box, external vault. Keep old URLs. |
| P2 | Visible grade values often omit the grader even though the model already has `gradeLabel`. The 3D payload stores the bare number for display (`wall3dPage.js:1116`). | Always show CGC/CBCS/PSA/TAG with grade. Split grading distributions by grader and kind as cards arrive. |
| P2 | Search reports all matches but renders only 60, with no pagination (`indexPage.js:172`). | Render all matches for this collection size or provide an explicit continuation. Add edition, creator, container and value-state filters. |
| P2 | The dashboard tells public readers to run `npm run fmv`; most of the missing values are not simply unfetched. | Owner tools should offer an actionable review queue. Family copy should explain what is unknown and where supporting evidence can be found. |

The review has not applied these production fixes. They are acceptance criteria for the first implementation slice.

## The proposed experience

### 1. The museum entrance

A dark, quiet gallery with three large real slab scans, editorial type and a restrained brass accent. The cover art supplies the color. A visitor can inspect one object immediately, enter the existing 3D room, or explore a subject they recognize.

Four initial exhibit ideas drawn from this collection: the Spider-Verse, foil covers, Star Wars, and Back to the Future variants. Later add collections based on cover artist and the owner's chosen favorites. A favorite should be an explicit owner choice, never inferred from its price.

The interactive concept implements a four-item shelf and search over the complete 244-record snapshot. It uses actual front/back scans for the four featured items. Other search results offer a complete-bin link for their scans.

### 2. The inspection desk

An exact-copy record accessible from every view. Desktop gets a large scan beside a readable evidence panel; phone gets a stacked layout. Front/back flip, full title and edition, grader/grade, cert, source links and physical container live together.

Add three distinct areas in production: **The object**, **The story**, and **The value**. The first is factual identity. The second is the owner's optional text, voice note, acquisition memory or reason for keeping it. The third is dated evidence. A generated description must never masquerade as the owner's memory.

The prototype shows factual records and an explicitly labeled story placeholder. It does not invent anecdotes or claim to save them.

### 3. The family guide

A calm paper-colored view with plain language: identify the exact comic, locate it, then understand its record. Start with the collection count and recorded subtotal plus coverage. Make “not yet valued” readable, and keep missing items out of priced totals.

The useful next deliverable is a downloadable **family packet**: readable offline index, item/box manifest, dated value evidence, cover thumbnails, owner instructions and a trusted contact chosen by the owner. Offer a ZIP with local assets and printable PDFs. The packet should remain useful without GitHub, a subscription, the editor account or the 3D engine. Verify it in a disconnected browser before calling it complete.

Keep sensitive room details, acquisition costs, private instructions and contact information out of the public build. A “Family” navigation tab is a reading mode, not access control. This project's existing public gallery and separate owner editor make that distinction concrete. Do not store account passwords in collection records or export packets.

### 4. The owner's workbench

An inbox based on the work actually needed: missing valuation, weak variant match, stale observation, missing scan, missing location. Display counts and let the owner work through a small batch. Show a proposed import diff before applying it and provide undo/history.

Preserve the existing Krono round trip and grading lookups. Import observations with their source and confidence/match evidence. Avoid silently replacing an exact-cover match with a similar item's image or a generic edition's price.

## Experiments that could make this memorable

| Idea | The experience | What makes it useful |
| --- | --- | --- |
| A guided longbox tour | The owner chooses 5–10 items; each stop brings a slab forward with an optional voice note. | A personal story can be shared in a few minutes. Manual next/previous and a text transcript remain available. |
| A shelf that matches the room | Digital rows use the actual container names; selecting a book highlights its container. | The impressive 3D view also teaches a family member where to find things. Recorded slots are optional and never inferred from array order. |
| A constellation of cover art | Group the collection by artist, character, year or series; selecting a relationship rearranges the view. | Encourages discovery without needing to know a cert number. Provide equivalent list filters. Derived relationships must be traceable to metadata. |
| The light table | Tilt reflective covers under a subtle virtual light, with original-scan and effect modes. | Celebrates the foil/metal scans already collected. Effects are illustrative; grading and condition checks use the unaltered scan. |
| Your reasons for keeping it | A short note or genuine recorded voice beside selected items. | Preserves the part a price database can never supply. |

My order: inspection desk and family guide first, then guided longbox tours. Constellations and material effects belong in an optional experimental area after the basic item flow is reliable.

## Valuation with less repeated work

Model **observations**, rather than overwriting a single current number. An observation needs amount/currency, source, source URL, observed date, item match, and evidence type. Distinguish a provider estimate, sold comparable, active asking price and owner estimate. Save any sold sample size and last sale date when available; absence stays unknown.

The UI should say, for example, “GoCollect FMV · recorded Aug 27” and expose supporting details. “High confidence” should require defined evidence rules, not a decorative score. Do not synthesize a trend line until real comparable historical observations exist. Do not present the spread between asking prices as a forecast range.

Offer an owner-selected refresh policy and a batch review workflow. Start with the 81 missing values and records that lack dependable edition matches. Family readers see the last recorded evidence, its age, and which items still need research. No live scraping is needed for them to browse.

## Adjustments before building the cards spec

- Use an item key that includes grader and cert, ideally alongside a stable internal item ID; a bare cert can collide across companies. Distinguish the physical item from its current grading record if regrading is supported later.
- Keep `kind` explicit for cards and preserve the existing comic default. Separate title formatting, grader verification and value source presentation from page templates.
- Give containers `kind`, title and physical/virtual status. Do not call the PSA Vault a bin or generate a physical label for it.
- Preserve raw imported rows and TAG reports. Make normalization an adapter, not a destructive rewrite of source data.
- PSA Vault CSV can be the initial import; optional image/population enrichment should not block core records. The supplied spec records 49 rows, but that export was not independently imported in this review.
- Grade identity and observations have different lifetimes. Population, rankings and prices can change; each needs an observation timestamp. Missing population is not zero. Only calculate top pop when the source actually supports a higher-count of zero.
- Do not run CGC-specific chart or pricing assumptions across PSA and TAG cards unchanged. Keep currencies explicit and aggregate only comparable totals.

## Technology recommendation

For the next substantial UI implementation, I would use **Astro + TypeScript**, with static pages and small interactive components, and retain **Three.js** for the room. Keep the current Node import/image/print pipeline and JSON source of truth initially. The immediate navigation and value-label fixes can be made in the current templates before any migration.

Astro's islands architecture renders most content as static HTML and adds JavaScript for selected interactions. That is a good fit for a durable collection record with an optional rich exhibit; the fit is my assessment of this project. See the [official Astro explanation](https://docs.astro.build/en/concepts/islands/).

Reuse the existing Three.js scene before introducing a rendering abstraction. Profile loading, frame time and memory on a representative phone; progressively load textures, pause hidden scenes, and reduce object/draw work where measurements justify it. Three.js documents the cost of many separate objects in its [optimization guide](https://threejs.org/manual/en/optimize-lots-of-objects.html). Respect the user's [reduced-motion preference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion), with a stable still-view equivalent.

Do not make a database, accounts for viewers, live AI queries or a framework rewrite prerequisites for browsing. Add a private persistence layer only when shared editing/private family content actually requires it. A reusable item schema and shared UI components are more urgent than changing storage.

## Delivery sequence and definition of done

1. **Connect the existing experience.** Fix the dashboard return, item anchors/routes, complete search results, keyboard sorting, grader labels, estimate/source/date consistency and container titles. A QR → exact copy → evidence → back journey must work on phone and keyboard.
2. **Build the museum entrance and inspection desk.** Shared navigation and visual tokens; real scans; clear missing-image states; front/back/zoom; preservation of current bin QR paths. A viewer can identify a random slab and locate its record without needing owner help.
3. **Make the family guide durable.** Fill container locations once, add private notes deliberately, generate and test the offline family packet. Every amount has source/date/coverage; unknown values never become zero.
4. **Add cards through adapters.** Offline vault import, then optional PSA/TAG enrichment, card-specific sheets, honest cross-category totals and image size budgets.
5. **Add one signature experiment.** A curated longbox tour is the first choice. Keep its accessibility and low-motion equivalent intact.

Target acceptance measures: exact-item identity and location reachable within two selections from a search result; controls usable by keyboard; no horizontal overflow at 390px; primary touch controls at least 44px; original art unaltered in inspection; no 3D downloads on the ordinary family page; print/QR regressions checked whenever those outputs change. No performance benchmark is claimed from this review.

## Review artifacts

- Build the local concept with `node docs/prototypes/build-museum.mjs` from the repository root. It creates `docs/prototypes/museum.html` and `dist/review/index.html`; neither changes the production templates or collection data. An ordinary build clears `dist`, so rerun the concept builder afterward.
- The HTML embeds a dated snapshot and four front/back image pairs for portability. Production should use sized external assets; embedding everything in one page is a review convenience.
- Local prototype: [Personal museum](http://localhost:4175/review/), while the preview server is running.
- [Superdesign canvas](https://superdesign.dev/teams/51f27b24-2320-4ebf-8425-4f4b65ac6666/projects/7687b5a7-24c5-4f82-b6aa-d5d2e966ee9a), with current-home baseline and the concept.
- [Concept preview](https://p.superdesign.dev/draft/8ba17025-90c5-4301-a38b-2a2ad6d1b2d1).

The concept implements gallery selection, scan flipping, exact-cert/text search, a missing-market-value filter, container links and the family reading mode. Story editing, family packet generation, automated price refresh, PSA/TAG import and new 3D formations remain proposals. Existing external links open the current published collection and source sites.
