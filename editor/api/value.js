import { requireSession } from '../lib/session.js';
import { listBins, putBin } from '../lib/github.js';
import { applyEdit } from '../lib/apply.js';

/**
 * Set or clear one hand-entered value, and commit it.
 *
 * Reads fresh before writing so the blob sha is current: GitHub rejects a write
 * whose sha is stale, which is what stops two devices from silently overwriting
 * each other. A rejected write surfaces as a conflict rather than lost data.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const session = requireSession(req, res);
  if (!session) return;

  const { cert, value, note } = req.body ?? {};
  if (!cert) return res.status(400).json({ error: 'cert is required' });

  try {
    const bins = await listBins(session.token);
    const { file, data, comic } = applyEdit(bins, { cert, value, note });
    const sha = bins.find((b) => b.file === file).sha;

    data.updated = new Date().toISOString().slice(0, 10);

    const money = comic.manual?.value != null ? `$${comic.manual.value}` : 'cleared';
    await putBin(session.token, {
      file,
      sha,
      data,
      message: `Set value for ${comic.title} #${comic.issue} to ${money}\n\nEdited via the hosted value editor by ${session.login}.`,
    });

    res.status(200).json({ ok: true, cert: comic.cert, manual: comic.manual ?? null });
  } catch (err) {
    // A 409 from GitHub means the file changed under us — worth saying plainly.
    const conflict = /409/.test(err.message);
    res.status(conflict ? 409 : 400).json({
      error: conflict ? 'That bin changed elsewhere — reload and try again.' : err.message,
    });
  }
}
