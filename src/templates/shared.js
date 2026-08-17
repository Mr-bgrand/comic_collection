/** Shared helpers and design tokens for every generated page. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * System stacks only — no webfonts. Print has to be byte-identical offline, and
 * a label printed in five years should not depend on a font CDN still existing.
 */
export const FONT_SANS =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const FONT_NARROW =
  '"Helvetica Neue Condensed", "Arial Narrow", "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

/** Ink-economical near-black; pure #000 prints heavy and reads harsh on screen. */
export const INK = '#16161a';

export function page({ title, css, body, lang = 'en' }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
${css}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}
