/**
 * The slice of the GitHub API this editor needs: read a file, write a file.
 *
 * Writes go through the signed-in user's own OAuth token, so every change is a
 * real commit attributed to them. There is no bot account and no long-lived
 * server-side token to leak.
 */

const API = 'https://api.github.com';

export function repoSlug() {
  const slug = process.env.GITHUB_REPO;
  if (!slug || !slug.includes('/')) {
    throw new Error('GITHUB_REPO must be set, e.g. Mr-bgrand/comic_collection');
  }
  return slug;
}

async function gh(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'comic-collection-editor',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`GitHub ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export async function currentUser(token) {
  return gh(token, '/user');
}

/** Every bin file, with the blob sha each write must supply. */
export async function listBins(token) {
  const slug = repoSlug();
  const entries = await gh(token, `/repos/${slug}/contents/data/bins`);
  const files = entries.filter((e) => e.type === 'file' && e.name.endsWith('.json'));

  return Promise.all(
    files.map(async (entry) => {
      const file = await gh(token, `/repos/${slug}/contents/${entry.path}`);
      return {
        file: entry.path,
        sha: file.sha,
        data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')),
      };
    }),
  );
}

/**
 * Commit a bin file.
 *
 * The sha is required by the API and is what makes this safe against lost
 * updates: if the file moved since it was read, GitHub rejects the write rather
 * than silently overwriting someone else's change.
 */
export async function putBin(token, { file, sha, data, message }) {
  const slug = repoSlug();
  const content = Buffer.from(`${JSON.stringify(data, null, 2)}\n`, 'utf8').toString('base64');
  return gh(token, `/repos/${slug}/contents/${file}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha }),
  });
}
