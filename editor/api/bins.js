import { requireSession } from '../lib/session.js';
import { listBins } from '../lib/github.js';

/**
 * Every bin, read live from the repository so the editor always shows what is
 * actually committed rather than a stale build artifact.
 */
export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  try {
    const bins = await listBins(session.token);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      bins: bins.map(({ file, sha, data }) => ({ file, sha, ...data })),
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
