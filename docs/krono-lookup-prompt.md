# Prompt for krono-find-sell-price

Paste the block below into that project, pointed at an `export/bin-NN/` folder
produced by `npm run export` in this repository.

Everything it needs travels in the folder: one CSV and the cover scans, with
filenames that tie back to rows. No path column, no manifest, no shared database
— the CGC certification number is the key, and it is both the CSV's first column
and the image filename stem.

---

## The prompt

> You are pricing CGC-graded comic books from a folder I will point you at.
>
> **The folder contains**
>
> - `bin-NN.csv` — one row per comic, header row first
> - `<cert>_front.jpg` and `<cert>_back.jpg` — the CGC scans for that comic
>
> A row's images are found by its `cert` value: row `4395549004` has
> `4395549004_front.jpg`. Some comics have no scans; those cells are empty.
>
> **Columns**
>
> | Column | Meaning |
> | --- | --- |
> | `cert` | CGC certification number — the unique key. Never invent or alter it. |
> | `bin` | Which storage bin the book lives in |
> | `title`, `issue` | Series title and issue number. `issue` is `nn` for unnumbered books |
> | `variant` | CGC's verbatim variant string. This is what distinguishes near-identical books |
> | `grade` | CGC numeric grade, 0.5–10. Treat as exact; a 9.8 and a 9.6 are different products |
> | `page_quality` | WHITE, OFF-WHITE, etc. |
> | `publisher`, `issue_year`, `label_category` | Context. `issue_year` is blank when CGC has no real date |
> | `key_comments` | CGC's note on why the book matters (first appearances, homages) |
> | `pop_at_grade`, `pop_higher`, `top_pop` | CGC census. `top_pop=yes` means none graded higher |
> | `gocollect_fmv` | Fair market value already known, in USD, or blank |
> | `gocollect_url` | That book's GoCollect page, or blank |
> | `manual_value` | A value entered by hand, or blank |
> | `needs_price` | **`yes` = no price from any source. These are the job.** |
> | `search_query` | A prebuilt marketplace query. Start here, then refine |
> | `front_image`, `back_image` | Filenames in this folder, or blank |
> | `variant_group_size` | How many books in this collection share this title and issue. 1 means no ambiguity |
> | `match_difficulty` | `unique`, `text`, or `visual` — **read this before searching** |
> | `exclude_terms` | Words belonging to the *other* variants of this issue. Exclude them from the query |
> | `confusable_certs` | The certs this book could be mistaken for |
>
> **`match_difficulty` tells you what will and will not work**
>
> - **`unique`** — nothing else in the collection shares this title and issue.
>   The query alone is safe.
> - **`text`** — siblings exist, but this book has distinguishing words they
>   don't. Search normally and add `exclude_terms` as negative keywords.
> - **`visual`** — **no query can separate this book from its siblings.** Either
>   it is the base issue, whose search terms are a strict subset of every
>   variant's, or the only difference is a letter (`Cover B` vs `Cover C`), or the
>   variant is identical and only the grade differs. Here the cover image is the
>   discriminator, not the text. Compare `front_image` against the listing photo
>   and match on the artwork. If you cannot see a listing's photo clearly, return
>   `match_confidence=none`.
>
> **What I want**
>
> For every row, find **active listings** and **completed/sold listings**, then
> return the CSV back to me with these columns appended:
>
> `active_low`, `active_high`, `active_count`,
> `sold_low`, `sold_median`, `sold_high`, `sold_count`,
> `sold_last_date`, `match_confidence`, `match_notes`, `listing_url`
>
> Sold prices are what I actually want; active prices are asking prices and I
> will read them as such. Report them separately and never blend them into one
> number.
>
> **Prioritise `needs_price=yes`.** Those books have no valuation from anywhere.
> The rest already have a market figure and are useful mainly as a sanity check
> — if your sold median disagrees wildly with `gocollect_fmv`, say so rather
> than quietly overriding it.
>
> **Matching is the hard part, and precision matters more than coverage.**
>
> Nearly half this collection shares a title and issue with something else. Moon
> Man #1 appears six times; Amazing Spider-Man #21 five times. A price for the
> wrong variant is worse than no price, because it looks like an answer.
>
> - **Check `match_difficulty` first.** It tells you whether text can do the job.
> - **Apply `exclude_terms` as negative keywords.** For a base issue this is the
>   only thing standing between it and its own variants.
> - Retailer names often contain generic words — "The Comic Corner",
>   "Unknown Comics", "No Masss Comics". Match those as phrases, not loose
>   keywords, or you will match the entire category.
> - **The grade must match exactly.** Do not average a 9.8 comp into a 9.6 book.
>   Two rows here are the same variant at different grades and are different books.
> - **Confirm against the cover image.** Virgin (textless), foil, sketch and metal
>   variants of one issue look obviously different side by side, and listing
>   titles frequently mislabel them. The image is evidence; the title is a claim.
> - The cert number sometimes appears in listing titles or photos. An exact cert
>   match identifies that specific slab — useful, though it means you have found
>   this very copy rather than a comparable.
> - When nothing matches confidently, return `match_confidence=none` and leave the
>   price columns blank. **Do not substitute a base-issue price for a variant** —
>   an empty cell is a fact, a wrong number is a liability.
>
> Set `match_confidence` to `high`, `medium`, `low`, or `none`, and use
> `match_notes` to say in a few words what you matched on and what you rejected,
> so I can audit a surprising number.
>
> Return the completed CSV. Keep every original column and row, unchanged, in the
> same order.

---

## Why the columns are shaped this way

**`needs_price` is the instruction, not a status.** 22 of 71 books have no
valuation from any source — they are retailer exclusives GoCollect does not
carry. Those are also disproportionately the scarce ones: 12 of them are top pop,
including a CGC 10 and two 9.9s. The missing data is not a sign of low value.

**Sold and active are separate columns on purpose.** GoCollect's figure is
already sales-derived, so an active asking price is a weaker kind of evidence
sitting next to a stronger one. Merging them would quietly degrade a number that
is currently trustworthy.

**Confidence is required, not optional.** For obscure variants the honest answer
is often "no comparable sale exists". A tool that always returns a number gives
you no way to tell a real comp from a guess.

## Feeding results back

```bash
npm run prices -- path/to/returned.csv
```

Matches on `cert` and stores results under `market`, alongside `fmv` rather than
on top of it. GoCollect's figure comes from completed sales; a marketplace scrape
is a different kind of evidence with a different confidence attached. Merging
them would destroy the ability to say where a number came from, which is the one
thing an appraisal needs.

Rows are **refused**, not stored, when:

- `match_confidence` is missing or `none` — an unvouched number looks like an
  answer, which is worse than a blank
- there is no sold data, only active listings — asking prices are what sellers
  hope for, not what anything traded at

Anything matched at `low` confidence is listed on import so you can check it by
eye.

## Why two repositories rather than one

They stay separate and are coupled only by this file format. Different jobs,
different credentials, different release cadences; the lookup tool also handles
sports cards and has no business knowing how comic bins are stored. A CSV
handoff is inspectable when a number looks wrong, which a shared database or a
common package would not be.

The full loop:

```bash
npm run export                      # hand off: CSV + cover scans
#   ... run the lookup tool ...
npm run prices -- returned.csv      # merge results home
npm run build && npm run print      # rebuild site and paperwork
```
