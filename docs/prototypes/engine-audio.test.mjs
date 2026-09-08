import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundtrack } from './engine-audio.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function setup(saved = null) {
  const events = new Map(), values = new Map(saved ? [['collection-singularity-music', saved]] : []);
  const audio = { paused: true, currentTime: 43, calls: 0, src: '', error: null,
    getAttribute(name) { return this[name]; }, addEventListener(name, fn) { events.set(name, fn); },
    play() { this.calls++; this.paused = false; events.get('playing')?.(); return Promise.resolve(); },
    pause() { this.paused = true; events.get('pause')?.(); }, load() { this.error = null; } };
  const button = { dataset: {}, setAttribute(name, value) { this[name] = value; } };
  const controller = createSoundtrack({ audio, button, source: './audio/cornfield-chase.mp3', storage: {
    getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)
  } });
  const play = { active: true, playing: true };
  return { audio, button, controller, play, values };
}
test('music loads on demand, loops, and retains its position through repeated scene updates', async () => {
  const { audio, controller, play } = setup();
  controller.setPlayback({ active: false, playing: false });
  assert.equal(audio.src, '');
  controller.setPlayback(play); await flush();
  controller.setPlayback(play); await flush();
  assert.equal(audio.calls, 1); assert.equal(audio.loop, true); assert.equal(audio.currentTime, 43);
  controller.setPlayback({ ...play, playing: false }); assert.equal(audio.paused, true);
  controller.setPlayback(play); await flush(); assert.equal(audio.paused, false); assert.equal(audio.currentTime, 43);
});
test('leaving the scene, reduced motion, and backgrounding pause music without changing its enabled preference', async () => {
  const { audio, button, controller, play } = setup();
  for (const pause of [{ active: false }, { quiet: true }, { hidden: true }]) {
    controller.setPlayback(play); await flush(); assert.equal(audio.paused, false);
    controller.setPlayback({ ...play, ...pause }); assert.equal(audio.paused, true);
    assert.equal(button['aria-pressed'], 'true');
  }
  controller.setPlayback(play); await flush(); assert.equal(audio.paused, false);
});
test('an explicit music-off choice survives resumes and page reloads', async () => {
  const { audio, button, controller, play, values } = setup();
  controller.setPlayback(play); await flush(); button.onclick();
  controller.setPlayback(play); controller.retry(); await flush();
  assert.equal(audio.paused, true); assert.equal(values.get('collection-singularity-music'), 'off');
  const reload = setup('off'); reload.controller.setPlayback(play); await flush();
  assert.equal(reload.audio.calls, 0);
  reload.button.onclick(); await flush(); assert.equal(reload.audio.paused, false);
});
test('autoplay denial is recoverable with a real button press, without falsely reporting playback', async () => {
  const { audio, button, controller, play } = setup(); const allowed = audio.play;
  audio.play = () => Promise.reject(Object.assign(new Error('Tap required'), { name: 'NotAllowedError' }));
  controller.setPlayback(play); await flush();
  assert.equal(button.dataset.state, 'blocked'); assert.equal(button['aria-pressed'], 'false');
  audio.play = allowed; button.onclick(); await flush(); assert.equal(button.dataset.state, 'playing');
});
test('a delayed play failure cannot override a newer pause or resume', async () => {
  const { audio, button, controller, play } = setup(); const allowed = audio.play;
  let reject; audio.play = () => new Promise((_, no) => { reject = no; });
  controller.setPlayback(play); controller.setPlayback({ ...play, playing: false });
  audio.play = allowed; controller.setPlayback(play); await flush();
  reject(Object.assign(new Error('Interrupted'), { name: 'AbortError' })); await flush();
  assert.equal(button.dataset.state, 'playing'); assert.equal(audio.paused, false);
});
