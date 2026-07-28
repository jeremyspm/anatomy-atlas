// ════════════════════════════════════════════════════════════════════════════
// HOUSE:GIGA:ANATOMY:JS:START
//
// Ported from gigastudyapp worktree `magical-kowalevski-1d3ceb` @ b3a33cb,
// components/studio/AnatomyModal.jsx (351 lines). The scene graph, the additive
// overlay model, the layer/ghost/dim maths, the camera framing, the raycast
// identify and the dispose teardown are the upstream's — same names, same
// constants, same order — so `.build/validate.js` can diff them mechanically.
//
// A self-hosted 3D anatomy atlas on open CC-BY-SA models (Z-Anatomy +
// AnatomyTOOL). No API, no account, no per-view cap.
//
// UNIFIED ATLAS: one body, systems as ADDITIVE layers. Each Z-Anatomy system is
// its own group, lazy-loaded when you toggle it on and kept in the scene so
// multiple systems overlay (they share one coordinate space). Within a system,
// sub-layers (arteries/veins/heart, …) toggle + isolate. Cardiovascular/nervous
// are recoloured by structure name; others keep authored colours.
//
// ── DECLARED DEVIATIONS from the upstream (see also index.html's CSS fence) ──
// D6  React → vanilla. `open`/`onClose` become the page lifetime; the four
//     useState slots (panel/status/selected/ghost) become four DOM updaters.
//     The upstream's dispose teardown is kept but runs on `pagehide`, since the
//     scene's lifetime IS the document's — there is no modal to close.
// D7  assetUrl(): the self-hosted ./anatomy/ copy is tried FIRST, with the
//     upstream's anatomyUrl() (Cloudinary) kept byte-for-byte as the fallback on
//     a load error. Upstream returns Cloudinary first and its local branch is an
//     absolute `/anatomy/...`, which would resolve off-root on GitHub Pages.
//     This is what makes the atlas work offline and stops the estate depending
//     on a free-tier CDN.
// D8  Reference-detail models are SURFACED. Upstream renders BODY_SYSTEMS only
//     (`group === 'Body systems'`), which hides 5 of the 8 shipped GLBs — 22 MB
//     of unreachable asset in a standalone tool. They are shown as a second,
//     EXCLUSIVE group: opening one closes everything else, because (as the
//     upstream comment states) they live in their own coordinate spaces and
//     cannot overlay. The constraint is honoured; the models are reachable.
// D9  Mobile: `setPixelRatio` caps at 1.5 rather than 2, nothing auto-loads,
//     and the rail is driven as a bottom sheet.
// D10 Per-system download size shown before you tap it (SIZES below).
// ════════════════════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SYSTEMS, getSystem, anatomyUrl, schemeFor, isLabelMesh } from './anatomy-systems.js';

const DRACO_PATH = './vendor/three/jsm/libs/draco/';
const GHOST_OPACITY = 0.06;
const DIM_OPACITY = 0.14;

// The additive atlas surfaces the aligned Z-Anatomy body systems; the
// AnatomyTOOL "Reference detail" models live in their own coordinate spaces and
// can't overlay, so they open one at a time (D8).
const BODY_SYSTEMS = SYSTEMS.filter((s) => s.group === 'Body systems');
const DETAIL_SYSTEMS = SYSTEMS.filter((s) => s.group === 'Reference detail');
const isDetail = (id) => DETAIL_SYSTEMS.some((s) => s.id === id);

// D10 — on-disk size of each shipped GLB, so a row can state its cost before you
// tap it. Kept here, NOT in anatomy-systems.js, so that copy stays byte-for-byte.
// Keyed by the registry's `id`, NOT the filename — `cardio` ships
// `cardiovascular.glb`, and keying by file silently drops the chip.
const SIZES = {
  cardio: 6.1, respiratory: 0.7, nervous: 5.9,
  skeleton: 3.3, skull: 1.1, hand: 3.1, upperlimb: 6.6, lowerlimb: 5.9,
};

const MOBILE = matchMedia('(max-width:768px)').matches;

const $ = (id) => document.getElementById(id);
const host = $('host');
const elStatus = $('status');
const elLayers = $('layers');
const elLabel = $('label');
const elHint = $('hint');
const elRail = $('rail');

// ── theme (contract rule 4: shared localStorage key with the hub) ────────────
const HTK = 'hub.theme';
$('btnTheme').addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(HTK, next); } catch (e) { /* private mode */ }
});

// ── the `?` explainer ────────────────────────────────────────────────────────
const help = $('help');
const openHelp = (v) => help.setAttribute('data-open', v ? '1' : '0');
$('btnHelp').addEventListener('click', () => openHelp(true));
$('btnCloseHelp').addEventListener('click', () => openHelp(false));
help.addEventListener('click', (e) => { if (e.target === help) openHelp(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openHelp(false); });

// ── D9/D4: bottom sheet on mobile ────────────────────────────────────────────
if (MOBILE) {
  $('handle').addEventListener('click', () => {
    const open = elRail.getAttribute('data-open') === '1';
    elRail.setAttribute('data-open', open ? '0' : '1');
    $('handle').setAttribute('aria-expanded', String(!open));
  });
  elRail.setAttribute('data-open', '0');
}

// ════════════════════════════════════════════════════════════════════════════
// scene
// ════════════════════════════════════════════════════════════════════════════
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2)); // D9
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x3a4048, 1.15));
const kl = new THREE.DirectionalLight(0xffffff, 1.6); kl.position.set(1, 2, 2); scene.add(kl);
const fl = new THREE.DirectionalLight(0xcfe0ff, 0.7); fl.position.set(-2, 1, -1); scene.add(fl);

const draco = new DRACOLoader().setDecoderPath(DRACO_PATH);
const loader = new GLTFLoader().setDRACOLoader(draco);

// D7 — self-hosted first, upstream's CDN resolver as the fallback.
const assetUrl = (file) => new URL('anatomy/' + file, import.meta.url).href;

// loaded[id] = { group, sub:{layerKey:{meshes,visible}}, total, enabled, loading }
const loaded = {};
const st = { sel: null, raf: 0, disposed: false, focused: null, ghost: true };

const resize = () => {
  const w = host.clientWidth || 1, h = host.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
};
const ro = new ResizeObserver(resize); ro.observe(host); resize();

const frame = (box) => {
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const dist = (maxDim / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.45;
  controls.target.copy(center);
  camera.position.set(center.x + dist * 0.12, center.y + dist * 0.04, center.z + dist);
  camera.near = maxDim / 100; camera.far = maxDim * 100; camera.updateProjectionMatrix();
  controls.update();
};
const frameEnabled = () => {
  const box = new THREE.Box3();
  for (const id in loaded) { const L = loaded[id]; if (L.enabled && L.group && L.group.visible) box.expandByObject(L.group); }
  frame(box);
};

// Apply one system's meshes: honour each sub-layer's visibility + the ghost
// switch, and dim the whole system when it's a non-focused overlay (2+ on).
const applySystem = (id) => {
  const L = loaded[id]; if (!L || !L.sub) return;
  const on = Object.values(loaded).filter((x) => x.enabled).length;
  const dimmed = on > 1 && id !== st.focused;
  for (const key in L.sub) {
    const g = L.sub[key];
    for (const m of g.meshes) {
      if (g.visible) {
        m.visible = true;
        m.material.opacity = dimmed ? Math.min(m.userData.baseOpacity, DIM_OPACITY) : m.userData.baseOpacity;
        m.material.transparent = dimmed || m.userData.baseTransparent;
      } else if (st.ghost) {
        m.visible = true; m.material.transparent = true; m.material.opacity = GHOST_OPACITY;
      } else {
        m.visible = false;
      }
    }
  }
};
const refreshVisuals = () => { for (const id in loaded) if (loaded[id].enabled) applySystem(id); };

const buildSystem = (s, gltf) => {
  const { layers: defs, classify, byName } = schemeFor(s.scheme);
  const group = gltf.scene;
  const sub = {};
  let total = 0;
  group.traverse((o) => {
    if (!o.isMesh) return;
    // The system-label text sits on the group's ROOT mesh, which is ALSO the
    // parent of every structure — blank its geometry (hiding the node would take
    // the whole system with it) and skip it.
    if (isLabelMesh(o.name)) { o.geometry = new THREE.BufferGeometry(); return; }
    o.material = o.material.clone();
    o.material.side = THREE.DoubleSide;
    const label = o.name || (o.parent && o.parent.name) || 'structure';
    const k = byName ? classify(label) : classify(o.material.name);
    if (byName) {
      const def = defs.find((d) => d.key === k);
      if (def && def.hex != null && o.material.color) {
        o.material.color.setHex(def.hex);
        o.material.metalness = 0.0; o.material.roughness = 0.55;
        if ('emissive' in o.material) o.material.emissive.setHex(def.hex).multiplyScalar(0.06);
      }
    }
    o.userData.baseOpacity = o.material.opacity;
    o.userData.baseTransparent = o.material.transparent;
    o.userData.label = label;
    o.userData.systemId = s.id;
    o.userData.layerKey = k;
    (sub[k] || (sub[k] = { meshes: [], visible: true })).meshes.push(o);
    total += 1;
  });
  return { group, sub, total, enabled: true, loading: false };
};

const refreshStatus = () => {
  const on = Object.values(loaded).filter((x) => x.enabled).length;
  const total = Object.values(loaded).reduce((a, x) => a + (x.enabled ? (x.total || 0) : 0), 0);
  setStatus(total + ' structures' + (on ? ' · ' + on + (on === 1 ? ' system' : ' systems') : ''));
};

function enableSystem(id) {
  const s = getSystem(id); if (!s || s.status !== 'ready') return;
  // D8 — reference-detail models can't share the body's coordinate space.
  if (isDetail(id)) { for (const k in loaded) if (k !== id && loaded[k].enabled) disableSystem(k, true); }
  else { for (const k of DETAIL_SYSTEMS.map((d) => d.id)) if (loaded[k] && loaded[k].enabled) disableSystem(k, true); }
  st.focused = id;
  const L = loaded[id];
  if (L) { L.enabled = true; L.loading = false; if (L.group) L.group.visible = true; refreshVisuals(); renderPanel(); frameEnabled(); refreshStatus(); return; }
  loaded[id] = { loading: true, enabled: true };
  renderPanel(); setStatus('Loading ' + s.label + '…');
  const done = (gltf) => {
    if (st.disposed) return;
    loaded[id] = buildSystem(s, gltf);
    scene.add(loaded[id].group);
    st.focused = id; refreshVisuals();
    renderPanel(); frameEnabled(); refreshStatus();
    setHint('Drag to orbit · scroll to zoom · tap a structure to identify it');
  };
  // D7 — self-hosted first, then the upstream CDN resolver.
  loader.load(assetUrl(s.file), done, undefined, () => {
    loader.load(anatomyUrl(s.file), done, undefined, (err) => {
      console.error(err);
      if (loaded[id]) delete loaded[id];
      renderPanel(); setStatus('Load failed');
      setHint('Couldn’t load ' + s.label + ' — check your connection and try again.');
    });
  });
}
function disableSystem(id, quiet) {
  const L = loaded[id]; if (!L) return;
  L.enabled = false; if (L.group) L.group.visible = false;
  if (st.focused === id) { st.focused = Object.keys(loaded).find((k) => loaded[k].enabled) || null; }
  if (quiet) return;
  refreshVisuals(); renderPanel(); frameEnabled(); refreshStatus();
}
const setFocus = (id) => { if (loaded[id] && loaded[id].enabled) { st.focused = id; refreshVisuals(); renderPanel(); } };
const setSub = (id, key, v) => { const L = loaded[id]; if (L && L.sub[key]) { L.sub[key].visible = v; applySystem(id); renderPanel(); } };
const isolateSub = (id, key) => {
  const L = loaded[id]; if (!L) return;
  st.focused = id;
  for (const k in L.sub) L.sub[k].visible = (k === key);
  refreshVisuals(); renderPanel();
  const b = new THREE.Box3();
  L.sub[key].meshes.forEach((m) => { if (m.visible) b.expandByObject(m); });
  frame(b);
};

// ── click-to-identify across all enabled systems ─────────────────────────────
const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const r = renderer.domElement.getBoundingClientRect();
  ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ptr, camera);
  const roots = Object.values(loaded).filter((L) => L.enabled && L.group).map((L) => L.group);
  const hits = ray.intersectObjects(roots, true).filter((h) => h.object.visible && h.object.material.opacity > 0.2);
  const o = hits[0] && hits[0].object;
  if (st.sel && st.sel.material.emissive) st.sel.material.emissive.setHex(st.sel.userData.emiPrev != null ? st.sel.userData.emiPrev : 0x000000);
  st.sel = o || null;
  if (!o) { setSelected(null); return; }
  o.userData.emiPrev = o.material.emissive ? o.material.emissive.getHex() : 0x000000;
  if (o.material.emissive) { o.material.emissive.setHex(0x5b8cff); o.material.emissiveIntensity = 0.5; }
  const s = getSystem(o.userData.systemId);
  const { layers: defs } = schemeFor(s && s.scheme);
  const def = defs.find((d) => d.key === o.userData.layerKey);
  const layer = (def && def.label) || '';
  setSelected({ label: o.userData.label, sub: ((s && s.label) || '') + (layer ? ' · ' + layer : ''), x: e.clientX - r.left, y: e.clientY - r.top });
});

const loop = () => { if (st.disposed) return; controls.update(); renderer.render(scene, camera); st.raf = requestAnimationFrame(loop); };
loop();

// D6 — the upstream's teardown, run at document end-of-life. Guarded on
// `persisted`: a bfcache suspend also fires pagehide, and disposing there would
// leave a dead canvas and a stopped render loop when the user taps Back (the
// module does not re-run on a bfcache restore).
window.addEventListener('pagehide', (e) => {
  if (e.persisted) return;
  st.disposed = true;
  cancelAnimationFrame(st.raf);
  ro.disconnect();
  for (const id in loaded) {
    const L = loaded[id]; if (!L.group) continue;
    scene.remove(L.group);
    L.group.traverse((o) => {
      if (o.isMesh) { o.geometry && o.geometry.dispose && o.geometry.dispose(); (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && m.dispose && m.dispose()); }
    });
  }
  controls.dispose(); renderer.dispose(); draco.dispose();
});
// HOUSE:GIGA:ANATOMY:JS:END

// ════════════════════════════════════════════════════════════════════════════
// D6 — the four useState slots, as DOM updaters. Upstream's JSX shape is kept
// (system row → sub-layer rows) so the markup diffs against it by eye.
// ════════════════════════════════════════════════════════════════════════════
function setStatus(t) { elStatus.textContent = t; }
function setHint(t) { elHint.textContent = t; }
function setSelected(sel) {
  if (!sel) { elLabel.hidden = true; return; }
  elLabel.hidden = false;
  elLabel.style.left = sel.x + 'px';
  elLabel.style.top = sel.y + 'px';
  elLabel.textContent = '';
  elLabel.append(sel.label, document.createElement('br'));
  const sub = document.createElement('span'); sub.textContent = sel.sub;
  elLabel.append(sub);
}

function panelModel() {
  const build = (s) => {
    const L = loaded[s.id];
    const enabled = !!(L && L.enabled);
    let layers = [];
    if (enabled && L.sub) {
      const { layers: defs } = schemeFor(s.scheme);
      layers = defs.filter((d) => L.sub[d.key] && L.sub[d.key].meshes.length)
        .map((d) => ({ key: d.key, label: d.label, color: d.color, count: L.sub[d.key].meshes.length, visible: L.sub[d.key].visible }));
    }
    return { id: s.id, label: s.label, status: s.status, enabled, loading: !!(L && L.loading), total: (L && L.total) || 0, layers, focused: st.focused === s.id };
  };
  return { body: BODY_SYSTEMS.map(build), detail: DETAIL_SYSTEMS.filter((s) => s.status === 'ready').map(build) };
}

function rowFor(s) {
  const wrap = document.createElement('div'); wrap.className = 'anat-sys';
  const row = document.createElement('div');
  row.className = 'anat-row anat-sysrow' + (s.status !== 'ready' ? ' off' : '') + (s.focused ? ' focus' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox'; cb.checked = s.enabled; cb.disabled = s.status !== 'ready';
  cb.addEventListener('change', () => (cb.checked ? enableSystem(s.id) : disableSystem(s.id)));
  row.append(cb);

  const nm = document.createElement('span'); nm.className = 'anat-name'; nm.textContent = s.label;
  if (s.enabled) {
    nm.style.cursor = 'pointer';
    nm.title = 'Focus this system (dim the others)';
    nm.addEventListener('click', () => setFocus(s.id));
  }
  row.append(nm);

  if (s.status !== 'ready') {
    const soon = document.createElement('span'); soon.className = 'anat-soon'; soon.textContent = 'coming';
    row.append(soon);
  } else if (s.loading) {
    const c = document.createElement('span'); c.className = 'anat-count'; c.textContent = '…';
    row.append(c);
  } else if (s.enabled) {
    const c = document.createElement('span'); c.className = 'anat-count'; c.textContent = s.total;
    row.append(c);
  } else if (SIZES[s.id]) {
    // D10 — state the cost before the tap.
    const z = document.createElement('span'); z.className = 'anat-size'; z.textContent = SIZES[s.id] + ' MB';
    row.append(z);
  }
  wrap.append(row);

  if (s.enabled && s.layers.length) {
    const subs = document.createElement('div'); subs.className = 'anat-sublayers';
    for (const l of s.layers) {
      const lr = document.createElement('div'); lr.className = 'anat-row anat-subrow';
      const lcb = document.createElement('input');
      lcb.type = 'checkbox'; lcb.checked = l.visible;
      lcb.addEventListener('change', () => setSub(s.id, l.key, lcb.checked));
      const sw = document.createElement('span'); sw.className = 'anat-sw'; sw.style.background = l.color;
      const ln = document.createElement('span'); ln.className = 'anat-name'; ln.textContent = l.label;
      const lc = document.createElement('span'); lc.className = 'anat-count'; lc.textContent = l.count;
      const only = document.createElement('button'); only.className = 'anat-only'; only.textContent = 'only';
      only.addEventListener('click', () => isolateSub(s.id, l.key));
      lr.append(lcb, sw, ln, lc, only);
      subs.append(lr);
    }
    wrap.append(subs);
  }
  return wrap;
}

function renderPanel() {
  const { body, detail } = panelModel();
  elLayers.textContent = '';

  const h1 = document.createElement('div'); h1.className = 'anat-grouphdr'; h1.textContent = 'Body systems';
  elLayers.append(h1);
  body.forEach((s) => elLayers.append(rowFor(s)));

  if (detail.length) {
    const h2 = document.createElement('div'); h2.className = 'anat-grouphdr'; h2.textContent = 'Reference detail';
    const note = document.createElement('div'); note.className = 'anat-groupnote';
    note.textContent = 'Higher-detail regional models. They have their own coordinate space, so opening one closes the rest.';
    elLayers.append(h2, note);
    detail.forEach((s) => elLayers.append(rowFor(s)));
  }

  // the mobile sheet handle mirrors the status line
  const on = body.concat(detail).filter((s) => s.enabled);
  const total = on.reduce((a, s) => a + s.total, 0);
  $('handleText').textContent = on.length ? on.map((s) => s.label).join(' · ') : 'Choose a system';
  $('handleCount').textContent = total ? total + ' structures' : '';
}

// ── first paint ──────────────────────────────────────────────────────────────
$('ghost').addEventListener('change', (e) => { st.ghost = e.target.checked; refreshVisuals(); });
$('btnReset').addEventListener('click', frameEnabled);

renderPanel();

// D9 — desktop opens populated (upstream behaviour). On a phone NOTHING loads by
// itself: 6 MB on mobile data without a tap is not acceptable, so the empty state
// says what to do instead of looking broken ([[self-explaining-ui-policy]]).
const first = BODY_SYSTEMS.find((s) => s.status === 'ready');
if (first && !MOBILE) {
  enableSystem(first.id);
} else {
  setStatus('Nothing loaded');
  setHint('Pick a system to load it — each one downloads only when you switch it on');
}
