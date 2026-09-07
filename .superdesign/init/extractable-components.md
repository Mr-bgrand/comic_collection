# Extraction candidates

No shared visible layout components exist. Skip layout extraction for the initial review concept.

## DocumentPage
- Source: src/templates/shared.js
- Category: layout utility, not a visible DraftComponent
- Props: title, css, body, lang
- Exclude from extraction: raw document assembly is not reusable canvas chrome.

## GradeBadge / CoverCard / ValueEvidence
- Category: basic
- Sources: src/templates/wallPage.js, src/templates/dashboard.js, src/templates/binPage.js
- Currently page-specific inline markup; future shared primitives should include grader, grade, evidence source/date, and stable item destination. Too small to extract into draft components now.
