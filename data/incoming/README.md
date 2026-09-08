# Intake files and cover photos

This directory keeps original imports, submitted cert lists, reviewed grader-page
captures and scan manifests. Dated audit files are historical; see the
[current collection status](../../docs/collection-status.md) for counts and pending work.

For the existing CGC photo importer, name photos by cert number:

    4245413012_front.jpg
    4245413012_back.jpg

Then run `npm run images:import`. Files move to `imported/` once processed.

For PSA, TAG, Authority, other graders, or phone photos, use local **Admin > Photos**
to select the exact copy and front/back side before reviewing and saving. Do not
rename another card's image to fill a missing scan. Grader image URLs and side
evidence remain in the import manifests; images are never chosen by file size.
