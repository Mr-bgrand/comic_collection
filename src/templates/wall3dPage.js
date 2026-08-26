/**
 * The vault — the wall, taken off the wall.
 *
 * An experimental WebGL sibling of /wall/. Same subject, same restraint about
 * colour, same data — but the slabs become what they actually are: rigid glossy
 * boxes with mass, hanging in a dark room. Design notes, as ever:
 *
 * The flat wall's specular sweep was a gradient pretending to be light. Here it
 * is real: every slab is a clearcoat material under an environment map, and the
 * torch is a genuine point light riding the pointer's ray into the scene. The
 * two pages describe the same object at two levels of honesty.
 *
 * Formations are the reason this page exists beyond spectacle. A collection has
 * more than one true shape — the museum wall, the longbox it actually lives in,
 * and a couple of shapes only software can hold — and gliding between them says
 * "same books, rearranged" in a way two static pages never could.
 *
 * Everything degrades deliberately: no WebGL or no CDN shows a plain note and a
 * link back to the flat wall, which remains the canonical page. This one is the
 * fire escape ride.
 *
 * Build constraints inherited from every other template: the css/script blocks
 * are embedded in template literals, so no backticks and no dollar-brace inside
 * them — strings are concatenated. templates.lint.test.js enforces this.
 */

import { displayTitle, isTopPop, fmvValue, manualValue, formatMoney, gradeLabel } from '../model.js';
import { escapeHtml } from './shared.js';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&display=swap';

/*
 * Pinned, not floating: a page that assembles itself from a CDN should behave
 * the same on every visit. r180 is well past this code's API surface.
 */
const THREE_VERSION = '0.180.0';

const css = `
:root {
  --void: #08080a;
  --ink: #f4f4f7;
  --mute: #8e8e9c;
  --cert: #2f6fd0;
  --pop: #e8b64c;
  --display: "Bricolage Grotesque", "Segoe UI", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; }

body {
  background: var(--void);
  color: var(--ink);
  font-family: var(--display);
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* The scene owns the whole viewport; everything else floats above it. */
#scene {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  outline: none;
}

#scene:focus-visible { outline: 2px solid var(--cert); outline-offset: -2px; }

/* ---------- chrome, borrowed wholesale from the flat wall ---------- */

.bar {
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 0.7rem 1rem;
  background: linear-gradient(to bottom, rgba(8, 8, 10, 0.92), rgba(8, 8, 10, 0));
  pointer-events: none;
  flex-wrap: wrap;
}

.bar > * { pointer-events: auto; }

.mark {
  font-weight: 800;
  font-size: 0.95rem;
  letter-spacing: -0.02em;
  text-decoration: none;
  color: var(--ink);
}

.mark span { color: var(--mute); font-weight: 400; }

.modes, .sorts { display: flex; gap: 0.15rem; }

.modes { margin-left: auto; }

.modes button, .sorts button, .flat {
  font: inherit;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--mute);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.3rem 0.6rem;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  text-decoration: none;
}

.modes button:hover, .sorts button:hover, .flat:hover { color: var(--ink); background: rgba(255, 255, 255, 0.1); }
.modes button[aria-pressed="true"] { color: var(--void); background: var(--pop); border-color: var(--pop); }
.sorts button[aria-pressed="true"] { color: var(--void); background: var(--ink); border-color: var(--ink); }
.modes button:focus-visible, .sorts button:focus-visible, .flat:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }

/* A thin gold line at the very top is the whole loading UI. */
.progress {
  position: fixed;
  inset: 0 auto auto 0;
  height: 2px;
  width: 0%;
  z-index: 50;
  background: var(--pop);
  opacity: 0.9;
  transition: width 0.25s ease, opacity 0.6s ease 0.3s;
  pointer-events: none;
}

.hint {
  position: fixed;
  bottom: 0.9rem;
  left: 1.1rem;
  z-index: 25;
  font-family: var(--mono);
  font-size: 0.66rem;
  letter-spacing: 0.04em;
  color: var(--mute);
  opacity: 0;
  transition: opacity 1s ease;
  pointer-events: none;
}

.hint.on { opacity: 0.85; }

/* ---------- atmosphere: same grain and vignette as the flat wall ---------- */

.grain {
  position: fixed;
  inset: 0;
  z-index: 12;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.vignette {
  position: fixed;
  inset: 0;
  z-index: 9;
  pointer-events: none;
  background: radial-gradient(
    ellipse 120% 90% at 50% 45%,
    rgba(0, 0, 0, 0) 55%,
    rgba(0, 0, 0, 0.45) 100%
  );
}

/* ---------- readout: identical structure to the flat wall ---------- */

.readout {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 1.1rem;
  padding: 0.75rem 1.1rem;
  background: rgba(8, 8, 10, 0.93);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(14px);
  transform: translateY(102%);
  transition: transform 0.24s cubic-bezier(0.2, 0.7, 0.3, 1);
  pointer-events: none;
}

.readout.on { transform: none; }

.grade {
  font-size: clamp(1.6rem, 4vw, 2.4rem);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
  padding-right: 1.1rem;
  border-right: 1px solid rgba(255, 255, 255, 0.14);
}

.grade.top { color: var(--pop); }

.who h2 {
  font-size: clamp(0.95rem, 2vw, 1.25rem);
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.15;
}

.who p {
  margin-top: 0.18rem;
  font-family: var(--mono);
  font-size: 0.73rem;
  color: var(--mute);
  letter-spacing: 0.01em;
}

.who .census { color: var(--pop); }

.money {
  text-align: right;
  font-family: var(--mono);
  font-size: 0.95rem;
  white-space: nowrap;
}

.money .bin {
  display: block;
  font-size: 0.66rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--mute);
  margin-top: 0.2rem;
}

.money .none { color: var(--mute); font-size: 0.78rem; }

/* Appears only while a slab is held out; the one clickable thing down here. */
.go {
  display: none;
  pointer-events: auto;
  font-family: var(--mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--void);
  background: var(--pop);
  border: 1px solid var(--pop);
  padding: 0.45rem 0.7rem;
  text-decoration: none;
  white-space: nowrap;
}

.readout.held .go { display: block; }
.go:focus-visible { outline: 2px solid var(--cert); outline-offset: 2px; }

/* ---------- boot and failure states ---------- */

.boot {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: var(--void);
  transition: opacity 0.7s ease;
}

.boot.gone { opacity: 0; pointer-events: none; }

.boot p {
  font-family: var(--mono);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--mute);
  animation: breathe 1.6s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

.fallback {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  text-align: center;
  background: var(--void);
  padding: 2rem;
}

.fallback[hidden] { display: none; }

.fallback h1 { font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em; }

.fallback p { margin-top: 0.6rem; color: var(--mute); font-size: 0.9rem; max-width: 26rem; }

.fallback a { color: var(--pop); }

@media (max-width: 34rem) {
  .bar { padding: 0.5rem 0.6rem; gap: 0.4rem; }
  .mark { font-size: 0.8rem; }
  .mark span { display: none; }
  .modes { margin-left: 0; }
  .modes button, .sorts button, .flat { font-size: 0.6rem; padding: 0.26rem 0.4rem; letter-spacing: 0.03em; }
  .hint { display: none; }
  .readout { grid-template-columns: auto 1fr auto; gap: 0.7rem; padding: 0.55rem 0.75rem; }
  .money { display: none; }
  .grade { font-size: 1.45rem; padding-right: 0.7rem; }
  .who h2 { font-size: 0.88rem; line-height: 1.2; }
  .who p { font-size: 0.63rem; line-height: 1.35; }
}

@media (prefers-reduced-motion: reduce) {
  .readout { transition-duration: 0.01ms; }
  .boot p { animation: none; }
}
`;

/*
 * A classic script, not a module, so it runs even when module resolution is the
 * thing that failed. If three.js has not announced itself within the window,
 * the CDN or WebGL is unavailable and the page says so instead of staying black.
 */
const boot = `
window.setTimeout(function () {
  if (window.__vaultBooted) return;
  var f = document.getElementById('fallback');
  var b = document.getElementById('boot');
  if (f) f.hidden = false;
  if (b) b.style.display = 'none';
}, 8000);
`;

const script = `
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Reaching this line means the CDN answered; the boot watchdog stands down.
window.__vaultBooted = true;

const DATA = JSON.parse(document.getElementById('wall-data').textContent);
const comics = DATA.comics;

const COVERS = '../../covers/';
const MEDIUM = '../../medium/';

// Real CGC slab: 6.75 x 10.625 x 0.6 inches. Kept to scale, width = 1.
const SLAB_W = 1;
const SLAB_H = 1.574;
const SLAB_D = 0.089;

const VOID = 0x08080a;
const GOLD = 0xe8b64c;

const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = window.matchMedia('(hover: none), (pointer: coarse)').matches;

function showFallback() {
  const f = document.getElementById('fallback');
  const b = document.getElementById('boot');
  if (f) f.hidden = false;
  if (b) b.style.display = 'none';
}

function main() {
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(VOID);
  // Depth is told by fog, not by drawing a room.
  scene.fog = new THREE.FogExp2(VOID, 0.026);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 0, 7);

  /*
   * The environment map is what makes the plastic read as plastic: the
   * clearcoat needs something to reflect. RoomEnvironment is a lamp-lit studio
   * generated on the GPU in one frame - no HDR download.
   */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const hemi = new THREE.HemisphereLight(0x8b93a8, 0x0b0b0e, 0.85);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xbfc8e8, 1.1);
  key.position.set(5, 9, 7);
  scene.add(key);

  // The torch, literalised: the flat wall fakes this pool with a gradient.
  const torch = new THREE.PointLight(0xffdfae, 36, 14, 2);
  scene.add(torch);

  /*
   * Shared geometry and shell material; only the cover map is per-slab. The
   * cover print itself is matte paper - the gloss lives in the clearcoat, which
   * is exactly how the physical object works.
   */
  const shellGeo = new RoundedBoxGeometry(SLAB_W, SLAB_H, SLAB_D, 3, 0.035);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x111116, roughness: 0.32, metalness: 0,
    clearcoat: 1, clearcoatRoughness: 0.2, envMapIntensity: 0.65,
  });
  const coverGeo = new THREE.PlaneGeometry(SLAB_W * 0.985, SLAB_H * 0.985);
  const goldGeo = new THREE.BoxGeometry(SLAB_W * 0.99, 0.034, 0.012);
  const goldMat = new THREE.MeshBasicMaterial({ color: GOLD });

  const slabRoot = new THREE.Group();
  scene.add(slabRoot);
  const labelRoot = new THREE.Group();
  labelRoot.visible = false;
  scene.add(labelRoot);

  const texLoader = new THREE.TextureLoader();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const progress = document.getElementById('progress');
  const toLoad = comics.filter((d) => d.img).length;
  let loaded = 0;

  function prepTexture(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAniso;
    return tex;
  }

  const slabs = comics.map(function (d, i) {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(shellGeo, shellMat);
    group.add(shell);

    let coverMat = null;
    if (d.img) {
      coverMat = new THREE.MeshPhysicalMaterial({
        color: 0x000000, roughness: 0.62, metalness: 0,
        clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 0.5,
      });
      const cover = new THREE.Mesh(coverGeo, coverMat);
      cover.position.z = SLAB_D / 2 + 0.003;
      group.add(cover);
    }
    if (d.top === 1) {
      // The same gold hairline the flat wall draws, now an object on the slab.
      const bar = new THREE.Mesh(goldGeo, goldMat);
      bar.position.set(0, -SLAB_H / 2 + 0.055, SLAB_D / 2 + 0.007);
      group.add(bar);
    }
    group.traverse(function (o) { o.userData.slab = i; });
    slabRoot.add(group);

    return {
      d, group, coverMat,
      fadeStart: -1, sharp: false,
      fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion(), fromScale: 1,
      homePos: new THREE.Vector3(), homeQuat: new THREE.Quaternion(), homeScale: 1,
      curPos: new THREE.Vector3(), curQuat: new THREE.Quaternion(), curScale: 1,
      t0: 0, dur: 0, hover: 0, phase: (i * 0.37) % (Math.PI * 2),
      held: false, heldPos: new THREE.Vector3(), heldQuat: new THREE.Quaternion(), heldScale: 1,
    };
  });

  slabs.forEach(function (s, i) {
    if (!s.d.img) return;
    texLoader.load(COVERS + s.d.img, function (tex) {
      s.coverMat.map = prepTexture(tex);
      s.coverMat.needsUpdate = true;
      s.fadeStart = performance.now();
      loaded += 1;
      progress.style.width = ((loaded / toLoad) * 100).toFixed(1) + '%';
      if (loaded >= toLoad) progress.style.opacity = '0';
    }, undefined, function () {
      loaded += 1;
      progress.style.width = ((loaded / toLoad) * 100).toFixed(1) + '%';
      if (loaded >= toLoad) progress.style.opacity = '0';
    });
  });

  /* ---------- formations ---------- */

  // Deterministic scatter for the entrance: same hand of cards every visit.
  function rnd(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const dummy = new THREE.Object3D();

  function layoutWall(n) {
    const cols = Math.ceil(Math.sqrt(n * 2.6));
    const rows = Math.ceil(n / cols);
    const sx = 1.08, sy = 1.66;
    const R = Math.max(10, (cols * sx) / 1.85);
    const slots = [];
    for (let k = 0; k < n; k++) {
      const col = k % cols, row = Math.floor(k / cols);
      const a = (col - (cols - 1) / 2) * (sx / R);
      dummy.position.set(Math.sin(a) * R, ((rows - 1) / 2 - row) * sy, R - 8.5 - Math.cos(a) * R);
      dummy.rotation.set(0, -a, 0);
      dummy.updateMatrix();
      slots.push({ pos: dummy.position.clone(), quat: dummy.quaternion.clone(), scale: 1 });
    }
    return { slots, cam: new THREE.Vector3(0, 0, 8), target: new THREE.Vector3(0, 0, -6), lift: 'forward' };
  }

  /*
   * The one formation that is documentary rather than invented: this is what
   * the shelf actually looks like. When sorted by bin, each row is that bin;
   * under any other sort the books deal into nine even boxes.
   */
  function layoutLongbox(n, order, byBin) {
    const groups = [];
    if (byBin) {
      const seen = {};
      order.forEach(function (i) {
        const b = comics[i].bin;
        if (!(b in seen)) { seen[b] = groups.length; groups.push({ label: 'BIN ' + b, items: [] }); }
        groups[seen[b]].items.push(i);
      });
    } else {
      const per = Math.ceil(n / 9);
      for (let g = 0; g < 9; g++) {
        const items = order.slice(g * per, (g + 1) * per);
        if (items.length) groups.push({ label: '', items });
      }
    }
    const B = groups.length;
    const slotByIndex = {};
    const boxes = [];
    groups.forEach(function (grp, g) {
      const x = (g - (B - 1) / 2) * 1.5;
      const zOff = ((grp.items.length - 1) * 0.17) / 2;
      boxes.push({ x, zFront: zOff, label: grp.label });
      grp.items.forEach(function (i, j) {
        dummy.position.set(x, 0, zOff - j * 0.17);
        dummy.rotation.set(-0.1, 0, 0);
        dummy.updateMatrix();
        slotByIndex[i] = { pos: dummy.position.clone(), quat: dummy.quaternion.clone(), scale: 1 };
      });
    });
    const slots = order.map(function (i) { return slotByIndex[i]; });
    return {
      slots, boxes,
      cam: new THREE.Vector3(0, 4.6, 9.2), target: new THREE.Vector3(0, -0.2, -0.5), lift: 'up',
    };
  }

  function layoutHelix(n) {
    const r = 5.4, step = 0.207;
    const drop = 11.8 / Math.max(1, n - 1);
    const slots = [];
    for (let k = 0; k < n; k++) {
      const a = k * step;
      dummy.position.set(Math.sin(a) * r, 5.9 - k * drop, Math.cos(a) * r);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      slots.push({ pos: dummy.position.clone(), quat: dummy.quaternion.clone(), scale: 1 });
    }
    return { slots, cam: new THREE.Vector3(0, 0.8, 14), target: new THREE.Vector3(0, 0, 0), lift: 'forward' };
  }

  function layoutOrbit(n) {
    const R = 6.4, GA = Math.PI * (3 - Math.sqrt(5));
    const slots = [];
    for (let k = 0; k < n; k++) {
      const y = 1 - (2 * (k + 0.5)) / n;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const a = k * GA;
      dummy.position.set(Math.cos(a) * rad * R, y * R, Math.sin(a) * rad * R);
      dummy.lookAt(dummy.position.x * 2, dummy.position.y * 2, dummy.position.z * 2);
      slots.push({ pos: dummy.position.clone(), quat: dummy.quaternion.clone(), scale: 1 });
    }
    return { slots, cam: new THREE.Vector3(0, 0, 14), target: new THREE.Vector3(0, 0, 0), lift: 'forward' };
  }

  const formations = { wall: layoutWall, longbox: layoutLongbox, helix: layoutHelix, orbit: layoutOrbit };

  /* ---------- longbox labels, drawn once per text ---------- */

  const labelCache = {};
  function labelMesh(text) {
    if (!labelCache[text]) {
      const cnv = document.createElement('canvas');
      cnv.width = 512; cnv.height = 128;
      const ctx = cnv.getContext('2d');
      ctx.fillStyle = '#8e8e9c';
      ctx.font = '500 58px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 68);
      const tex = new THREE.CanvasTexture(cnv);
      tex.colorSpace = THREE.SRGBColorSpace;
      labelCache[text] = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.325), labelCache[text]);
    return m;
  }

  function placeLabels(boxes) {
    labelRoot.clear();
    if (!boxes) return;
    boxes.forEach(function (b) {
      if (!b.label) return;
      const m = labelMesh(b.label);
      m.position.set(b.x, -1.05, b.zFront + 0.85);
      m.rotation.x = -0.9;
      labelRoot.add(m);
    });
  }

  /* ---------- ordering and layout application ---------- */

  let sortKey = 'bin';
  let mode = 'wall';
  let currentLift = 'forward';

  function orderedIndices() {
    const idx = comics.map(function (d, i) { return i; });
    const dir = sortKey === 'bin' ? 1 : -1;
    function val(i) { return sortKey === 'bin' ? comics[i].order : (comics[i][sortKey] || 0); }
    idx.sort(function (a, b) { return (val(a) - val(b)) * dir || comics[a].order - comics[b].order; });
    return idx;
  }

  const clock = { now: performance.now() };

  function setTarget(s, slot, delay) {
    s.fromPos.copy(s.curPos);
    s.fromQuat.copy(s.curQuat);
    s.fromScale = s.curScale;
    s.homePos.copy(slot.pos);
    s.homeQuat.copy(slot.quat);
    s.homeScale = slot.scale;
    s.t0 = clock.now + delay;
    s.dur = still ? 0 : 950;
  }

  function applyLayout(withStagger) {
    const order = orderedIndices();
    const layout = formations[mode](order.length, order, sortKey === 'bin');
    order.forEach(function (i, k) {
      setTarget(slabs[i], layout.slots[k], withStagger ? k * 5 : 0);
    });
    currentLift = layout.lift;
    labelRoot.visible = mode === 'longbox' && sortKey === 'bin';
    placeLabels(mode === 'longbox' ? layout.boxes : null);
    return layout;
  }

  /* ---------- camera ---------- */

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 30;
  controls.autoRotateSpeed = 0.45;

  const camTween = { on: false, t0: 0, dur: 1100, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3() };

  function flyCamera(pos, target) {
    camTween.on = true;
    camTween.t0 = clock.now;
    camTween.dur = still ? 0 : 1100;
    camTween.fromPos.copy(camera.position);
    camTween.toPos.copy(pos);
    camTween.fromTgt.copy(controls.target);
    camTween.toTgt.copy(target);
  }

  /* ---------- readout ---------- */

  const readout = document.getElementById('readout');
  const rGrade = document.getElementById('r-grade');
  const rTitle = document.getElementById('r-title');
  const rMeta = document.getElementById('r-meta');
  const rCensus = document.getElementById('r-census');
  const rAmount = document.getElementById('r-amount');
  const rBin = document.getElementById('r-bin');
  const rGo = document.getElementById('r-go');

  function showReadout(d) {
    rGrade.textContent = d.grade;
    rGrade.classList.toggle('top', d.top === 1);
    rTitle.textContent = d.title;
    rMeta.textContent = d.meta;
    rCensus.textContent = d.census ? ' — ' + d.census : '';
    rCensus.classList.toggle('census', d.top === 1);
    rAmount.textContent = d.money || 'no market value';
    rAmount.classList.toggle('none', !d.money);
    rBin.textContent = 'bin ' + d.bin;
    rGo.href = d.href;
    readout.classList.add('on');
  }

  function hideReadout() {
    readout.classList.remove('on', 'held');
  }

  /* ---------- interaction state ---------- */

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(0, -2);
  let pointerLive = false;
  let hovered = -1;
  let heldIdx = -1;
  let dim = 1;
  let lastMove = performance.now();

  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const torchGoal = new THREE.Vector3(0, 0, 2);

  function pickAt(x, y) {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    pointerLive = true;
    lastMove = performance.now();
  }

  window.addEventListener('pointermove', function (e) { pickAt(e.clientX, e.clientY); }, { passive: true });

  function hold(i) {
    const s = slabs[i];
    heldIdx = i;
    s.held = true;
    // Where the slab flies: dead centre, sized to the viewport, facing you.
    const dist = 2.35;
    camera.getWorldDirection(tmpV);
    s.heldPos.copy(camera.position).addScaledVector(tmpV, dist);
    s.heldQuat.copy(camera.quaternion);
    const vh = 2 * dist * Math.tan((camera.fov * Math.PI) / 360);
    const vw = vh * camera.aspect;
    s.heldScale = Math.min((vh * 0.68) / SLAB_H, (vw * 0.82) / SLAB_W);
    s.fromPos.copy(s.curPos); s.fromQuat.copy(s.curQuat); s.fromScale = s.curScale;
    s.t0 = clock.now; s.dur = still ? 0 : 650;
    controls.enabled = false;
    showReadout(s.d);
    readout.classList.add('held');
    // Only the slab actually in hand earns the 480px scan.
    if (s.d.img && !s.sharp) {
      s.sharp = true;
      texLoader.load(MEDIUM + s.d.img, function (tex) {
        if (s.coverMat) { s.coverMat.map = prepTexture(tex); s.coverMat.needsUpdate = true; }
      });
    }
  }

  function release() {
    if (heldIdx < 0) return;
    const s = slabs[heldIdx];
    s.held = false;
    s.fromPos.copy(s.curPos); s.fromQuat.copy(s.curQuat); s.fromScale = s.curScale;
    s.t0 = clock.now; s.dur = still ? 0 : 700;
    heldIdx = -1;
    controls.enabled = true;
    readout.classList.remove('held');
    if (hovered < 0) hideReadout();
  }

  // A click that followed a drag is the end of an orbit, not a choice.
  let downX = 0, downY = 0;
  canvas.addEventListener('pointerdown', function (e) { downX = e.clientX; downY = e.clientY; });
  canvas.addEventListener('click', function (e) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    pickAt(e.clientX, e.clientY);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(slabRoot, true);
    const i = hits.length ? hits[0].object.userData.slab : -1;
    if (i < 0) { release(); return; }
    if (i === heldIdx) { window.location.href = slabs[i].d.href; return; }
    release();
    hold(i);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { release(); return; }
    const order = orderedIndices();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const stepDir = e.key === 'ArrowRight' ? 1 : -1;
      const at = order.indexOf(heldIdx >= 0 ? heldIdx : hovered);
      const next = order[(at + stepDir + order.length) % order.length];
      if (heldIdx >= 0) { release(); hold(next); }
      else { hovered = next; showReadout(slabs[next].d); }
      lastMove = performance.now();
    }
    if (e.key === 'Enter' && document.activeElement === canvas) {
      if (heldIdx >= 0) window.location.href = slabs[heldIdx].d.href;
      else if (hovered >= 0) hold(hovered);
    }
  });

  /* ---------- chrome wiring ---------- */

  document.querySelectorAll('.modes button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.modes button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      mode = b.dataset.mode;
      release();
      const layout = applyLayout(true);
      flyCamera(layout.cam, layout.target);
      history.replaceState(null, '', '#' + mode);
    });
  });

  document.querySelectorAll('.sorts button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.sorts button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      sortKey = b.dataset.sort;
      release();
      applyLayout(true);
    });
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------- entrance ---------- */

  slabs.forEach(function (s, i) {
    const a = rnd(i) * Math.PI * 2;
    const rad = 20 + rnd(i + 500) * 14;
    s.curPos.set(Math.sin(a) * rad, (rnd(i + 900) - 0.5) * 26, Math.cos(a) * rad - 10);
    dummy.position.copy(s.curPos);
    dummy.rotation.set(rnd(i + 33) * 6.28, rnd(i + 77) * 6.28, 0);
    s.curQuat.copy(dummy.quaternion);
    s.curScale = 1;
  });

  const requested = (window.location.hash || '').slice(1);
  if (formations[requested]) {
    mode = requested;
    document.querySelectorAll('.modes button').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x.dataset.mode === mode));
    });
  }
  const first = applyLayout(true);
  camera.position.copy(first.cam);
  controls.target.copy(first.target);

  const bootEl = document.getElementById('boot');
  const hint = document.getElementById('hint');
  let frames = 0;

  /* ---------- the loop ---------- */

  function ease(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  let prev = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    clock.now = now;

    // Camera tween, then damping; the two never fight because the tween owns it.
    if (camTween.on) {
      const k = camTween.dur === 0 ? 1 : Math.min(1, (now - camTween.t0) / camTween.dur);
      const ek = ease(k);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, ek);
      controls.target.lerpVectors(camTween.fromTgt, camTween.toTgt, ek);
      if (k >= 1) camTween.on = false;
    }
    controls.autoRotate = !still && heldIdx < 0 && performance.now() - lastMove > 9000;
    controls.update();

    // One raycast serves hover, cursor, and torch alike.
    let hitPoint = null;
    if (pointerLive && !coarse) {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(slabRoot, true);
      if (hits.length) {
        hitPoint = hits[0].point;
        hovered = hits[0].object.userData.slab;
      } else {
        hovered = -1;
      }
      canvas.style.cursor = hovered >= 0 ? 'pointer' : '';
      if (heldIdx < 0) {
        if (hovered >= 0) showReadout(slabs[hovered].d);
        else hideReadout();
      }
      if (hitPoint) {
        tmpV2.copy(camera.position).sub(hitPoint).normalize();
        torchGoal.copy(hitPoint).addScaledVector(tmpV2, 1.15);
      } else {
        torchGoal.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 7);
      }
    } else if (coarse) {
      // No pointer to follow, so the torch wanders the room on its own.
      const t = now / 1000;
      ndc.set(Math.sin(t * 0.21) * 0.5, Math.sin(t * 0.13) * 0.35);
      raycaster.setFromCamera(ndc, camera);
      torchGoal.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 7);
    }
    torch.position.lerp(torchGoal, Math.min(1, dt * 8));

    // Held slabs dim the room around them; the tween makes it feel like lights.
    const wantDim = heldIdx >= 0 ? 0.3 : 1;
    dim += (wantDim - dim) * Math.min(1, dt * 6);
    hemi.intensity = 0.85 * dim;
    key.intensity = 1.1 * dim;

    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      const k = s.dur === 0 ? 1 : Math.max(0, Math.min(1, (now - s.t0) / s.dur));
      const ek = ease(k);

      if (s.held) {
        s.curPos.lerpVectors(s.fromPos, s.heldPos, ek);
        s.curQuat.copy(s.fromQuat).slerp(s.heldQuat, ek);
        s.curScale = s.fromScale + (s.heldScale - s.fromScale) * ek;
      } else {
        s.curPos.lerpVectors(s.fromPos, s.homePos, ek);
        s.curQuat.copy(s.fromQuat).slerp(s.homeQuat, ek);
        s.curScale = s.fromScale + (s.homeScale - s.fromScale) * ek;
      }

      // Hover eases in and out rather than snapping, like a hand reaching.
      const wantHover = hovered === i && heldIdx < 0 ? 1 : 0;
      s.hover += (wantHover - s.hover) * Math.min(1, dt * 9);

      s.group.position.copy(s.curPos);
      s.group.quaternion.copy(s.curQuat);
      let sc = s.curScale;

      if (s.hover > 0.004) {
        if (currentLift === 'up') {
          s.group.position.y += s.hover * 1.05;
        } else {
          tmpV.set(0, 0, 1).applyQuaternion(s.curQuat);
          s.group.position.addScaledVector(tmpV, s.hover * 0.55);
          sc *= 1 + s.hover * 0.22;
        }
      }

      if (!still && !s.held) {
        s.group.position.y += Math.sin(now / 1400 + s.phase) * 0.018;
      }

      s.group.scale.setScalar(sc);

      // Covers fade up from black as their scans arrive; held books ignore the
      // room dimming since they are the thing being lit.
      if (s.coverMat) {
        const fade = s.fadeStart < 0 ? 0 : Math.min(1, (now - s.fadeStart) / 600);
        const lit = s.held ? 1 : dim;
        s.coverMat.color.setScalar(fade * lit);
      }
    }

    renderer.render(scene, camera);

    frames += 1;
    if (frames === 2 && bootEl) {
      bootEl.classList.add('gone');
      if (hint) {
        hint.classList.add('on');
        setTimeout(function () { hint.classList.remove('on'); }, 9000);
      }
    }
  }

  requestAnimationFrame(frame);
}

try {
  main();
} catch (err) {
  showFallback();
  throw err;
}
`;

export function renderWall3dPage({ bins, config }) {
  const flat = bins.flatMap((bin) => (bin.comics ?? []).map((comic) => ({ comic, bin: bin.bin })));

  const comics = flat.map(({ comic, bin }, i) => {
    const value = fmvValue(comic) ?? manualValue(comic);
    const top = isTopPop(comic);

    const meta = [
      comic.publisher,
      comic.issueYear && comic.issueYear !== '1900' ? comic.issueYear : '',
      comic.pageQuality ? `${comic.pageQuality.toLowerCase()} pages` : '',
      `cert ${comic.cert}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const census = top
      ? `top pop — ${comic.population.atGrade} at ${comic.grade}, none higher`
      : comic.population && typeof comic.population.higher === 'number'
        ? `${comic.population.atGrade} at ${comic.grade} · ${comic.population.higher} higher`
        : '';

    return {
      order: i,
      img: comic.images?.front ?? null,
      grade: comic.grade ?? '',
      gradeNum: Number(comic.grade) || 0,
      value: value ?? 0,
      top: top ? 1 : 0,
      bin,
      href: `../../bin/${bin}/`,
      title: displayTitle(comic),
      meta,
      census,
      money: value !== null ? formatMoney(value) : '',
      label: `${displayTitle(comic)}, ${gradeLabel(comic)}, bin ${bin}`,
    };
  });

  /*
   * The data rides inside the page as JSON. Escaping every "<" as < is the
   * standard defence: a title containing "</script>" would otherwise end the
   * block and execute whatever follows it.
   */
  const json = JSON.stringify({ comics }).replace(/</g, '\\u003c');

  const name = config.collectionName ?? 'Comic Collection';
  const topPops = comics.filter((c) => c.top === 1).length;

  const importmap = JSON.stringify({
    imports: {
      three: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`,
      'three/addons/': `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`,
    },
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The vault — ${escapeHtml(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${css}
</style>
<script type="importmap">${importmap}</script>
</head>
<body>

<canvas id="scene" tabindex="0" role="application"
  aria-label="A 3D room of ${comics.length} graded comic slabs. Arrow keys move between slabs, Enter picks one up, Escape puts it back."></canvas>

<div class="vignette" aria-hidden="true"></div>
<div class="grain" aria-hidden="true"></div>
<div class="progress" id="progress" aria-hidden="true"></div>

<div class="bar">
  <a class="mark" href="../../">${escapeHtml(name)} <span>&mdash; ${comics.length} slabs, ${topPops} top pop</span></a>
  <div class="modes" role="group" aria-label="Formation">
    <button data-mode="wall" aria-pressed="true">Wall</button>
    <button data-mode="longbox" aria-pressed="false">Longbox</button>
    <button data-mode="helix" aria-pressed="false">Helix</button>
    <button data-mode="orbit" aria-pressed="false">Orbit</button>
  </div>
  <div class="sorts" role="group" aria-label="Sort">
    <button data-sort="bin" aria-pressed="true">Bin</button>
    <button data-sort="gradeNum" aria-pressed="false">Grade</button>
    <button data-sort="value" aria-pressed="false">Value</button>
    <button data-sort="top" aria-pressed="false">Top pop</button>
  </div>
  <a class="flat" href="../">Flat</a>
</div>

<div class="hint" id="hint">drag to orbit &middot; scroll to zoom &middot; click a slab to hold it</div>

<aside class="readout" id="readout" aria-live="polite">
  <div class="grade" id="r-grade"></div>
  <div class="who">
    <h2 id="r-title"></h2>
    <p><span id="r-meta"></span><span id="r-census"></span></p>
  </div>
  <div class="money">
    <span id="r-amount"></span>
    <span class="bin" id="r-bin"></span>
  </div>
  <a class="go" id="r-go" href="#">open bin &rarr;</a>
</aside>

<div class="boot" id="boot"><p>assembling ${comics.length} slabs</p></div>

<div class="fallback" id="fallback" hidden>
  <div>
    <h1>The vault needs WebGL</h1>
    <p>This corner of the site builds itself with three.js from a CDN and needs a
    browser with WebGL. Everything it shows is also on the flat wall.</p>
    <p><a href="../">Back to the wall &rarr;</a></p>
  </div>
</div>

<noscript>
  <div class="fallback">
    <div>
      <h1>The vault needs JavaScript</h1>
      <p>Everything here is also on the <a href="../">flat wall</a>.</p>
    </div>
  </div>
</noscript>

<script type="application/json" id="wall-data">${json}</script>
<script>
${boot}
</script>
<script type="module">
${script}
</script>
</body>
</html>
`;
}
