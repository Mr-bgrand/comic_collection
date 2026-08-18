import { getSession } from '../lib/session.js';

/** Who is signed in, if anyone. Never returns the token itself. */
export default function handler(req, res) {
  const session = getSession(req);
  res.status(200).json(
    session ? { signedIn: true, login: session.login, avatar: session.avatar } : { signedIn: false },
  );
}
