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
> - The `variant` string is the whole game. `Amazing Spider-Man #21` exists in a
>   dozen retailer variants at wildly different prices. A price for the wrong
>   variant is worse than no price, because it looks like an answer.
> - Retailer names often contain generic words — "The Comic Corner",
>   "Unknown Comics", "No Masss Comics". Match those as phrases, not loose
>   keywords, or you will match the entire category.
> - **The grade must match exactly.** Do not average a 9.8 comp into a 9.6 book.
> - Use the cover images to confirm a candidate listing shows the same artwork.
>   Virgin (textless), foil, sketch, and metal variants of one issue look
>   obviously different side by side, and listing titles frequently mislabel them.
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

Save the returned file and tell me where it is. I will merge it in, keeping
marketplace figures in their own field rather than overwriting `gocollect_fmv`,
so every number on the dashboard keeps saying where it came from.
