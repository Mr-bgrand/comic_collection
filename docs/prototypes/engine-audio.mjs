/** One looping soundtrack. Scene visibility and transport own playback, never HUD visibility. */
export function createSoundtrack({ audio, button, source, storage, onChange = () => {} }) {
  const key = 'collection-singularity-music';
  let enabled = true;
  try { enabled = storage?.getItem(key) !== 'off'; } catch {}
  let active = false, running = false, visible = true, pending = false, issue = '', generation = 0;
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = .65;
  const wanted = () => Boolean(source && enabled && active && running && visible);
  function render() {
    const state = !enabled ? 'off' : issue || (pending ? 'loading' : !audio.paused ? 'playing' : 'ready');
    button.textContent = ({ off: 'Music off', blocked: 'Music play ▷', error: 'Music retry ↻', loading: 'Music loading', playing: 'Music on ♪', ready: 'Music ready ♪' })[state];
    button.setAttribute('aria-pressed', String(enabled && !issue));
    button.setAttribute('aria-label', issue ? 'Play Cornfield Chase' : enabled ? 'Turn music off' : 'Turn music on');
    button.title = issue === 'error' ? 'Audio could not load. Tap to retry.' : issue === 'blocked' ? 'Tap to play Cornfield Chase · Hans Zimmer' : 'Cornfield Chase · Hans Zimmer. Music follows Singularity playback.';
    button.dataset.state = state;
    onChange(state);
  }
  function sync() {
    if (!wanted()) {
      generation++; pending = false; audio.pause(); render(); return;
    }
    if (pending || !audio.paused || issue) { render(); return; }
    if (!audio.getAttribute('src')) audio.src = source;
    const current = ++generation;
    pending = true; render();
    // Called synchronously from a tap when available; never defer play to a timer.
    let attempt;
    try { attempt = audio.play(); } catch (error) { attempt = Promise.reject(error); }
    Promise.resolve(attempt).then(() => {
      if (current !== generation) { if (!wanted()) audio.pause(); return; }
      pending = false; render();
    }, error => {
      if (current !== generation) return;
      pending = false;
      issue = error?.name === 'NotAllowedError' ? 'blocked' : 'error';
      render();
    });
  }
  function setPlayback({ active: nextActive, playing, quiet = false, hidden = false }) {
    active = nextActive; running = playing && !quiet; visible = !hidden;
    sync();
  }
  function retry() { issue = ''; if (audio.error) audio.load(); sync(); }
  button.onclick = () => {
    if (!enabled || issue) { enabled = true; issue = ''; if (audio.error) audio.load(); }
    else enabled = false;
    try { storage?.setItem(key, enabled ? 'on' : 'off'); } catch {}
    sync();
  };
  for (const event of ['playing', 'pause']) audio.addEventListener(event, render);
  audio.addEventListener('error', () => { pending = false; issue = 'error'; render(); });
  render();
  return { setPlayback, retry };
}
