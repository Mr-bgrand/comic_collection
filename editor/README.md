# Hosted value editor

Edit your collection's hand-entered values from anywhere, signed in with GitHub.
Each change is committed straight to this repository, which redeploys the site.

Deployed separately from the public catalogue: the catalogue is a static page
anyone with a bin QR can open, so it can never be the thing that writes.

## How the security works

- **GitHub OAuth**, and only the accounts named in `ALLOWED_LOGIN` may edit. A
  valid GitHub login is not the same as permission — signing in as anyone else
  gets a 403.
- **Your own token does the writing**, so every change is a real commit
  attributed to you. There is no bot account and no long-lived server-side token.
- **`public_repo` scope only.** This writes to one public repository, so the
  broader `repo` scope would be authority the editor has no use for.
- The token is sealed into an **httpOnly, Secure cookie** with AES-256-GCM. Page
  JavaScript cannot read it, and a tampered cookie fails to open rather than
  decrypting to something an attacker chose.
- Writes send the file's blob **sha**, so a change made elsewhere causes a
  conflict instead of silently overwriting.

Note this deliberately does *not* use a key embedded in the bin QR code. A key
printed on a label is visible to everyone you show the bin to, and photographs of
the label carry it — that is a lock that only looks like one.

## Setup

### 1. Create a GitHub OAuth app

<https://github.com/settings/developers> → **New OAuth App**

| Field | Value |
| --- | --- |
| Application name | Comic Collection Editor |
| Homepage URL | your Vercel URL |
| Authorization callback URL | `<your Vercel URL>/api/auth/callback` |

Generate a client secret and keep both values to hand.

### 2. Deploy

From this directory:

```bash
npx vercel deploy --prod
```

### 3. Set the environment variables

```bash
npx vercel env add GITHUB_CLIENT_ID production
npx vercel env add GITHUB_CLIENT_SECRET production
npx vercel env add SESSION_SECRET production      # 32+ random characters
npx vercel env add GITHUB_REPO production         # Mr-bgrand/comic_collection
npx vercel env add ALLOWED_LOGIN production       # Mr-bgrand
```

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then redeploy so the variables take effect, and set the OAuth app's callback URL
to the final production URL if it changed.

## Using it

Open the deployment, sign in, and edit. Books with no market value are listed
first — that is the actual gap — with GoCollect-priced ones below in case you
want to override one.

Values save when you leave a field. Each save is its own commit, so the history
shows what changed and when, and the site rebuilds automatically.

## Local alternative

`npm run edit` from the repository root does the same job with no hosting and no
login, writing directly to `data/bins/*.json`. Both share one implementation of
the edit rules ([`lib/apply.js`](lib/apply.js)) so they cannot drift.
