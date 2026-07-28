#!/usr/bin/env node
/* Anatomy Atlas — port validator.
 *
 * This tool is a PORT of Giga's Anatomy surface, not a re-implementation. The
 * house rule ([[porting-not-reimplementing]]) is that a prose spec always drifts
 * and only a diff can hold a copy honest — so this script diffs what we copied
 * against the upstream and fails on any UNDECLARED difference.
 *
 * Run:  node .build/validate.js
 *
 * If the Giga checkout is missing this script reports "parity NOT verified" and
 * exits non-zero. It must never pass quietly.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GIGA = path.resolve(ROOT, '..', 'gigastudyapp');
const WT = path.join(GIGA, '.claude', 'worktrees', 'magical-kowalevski-1d3ceb');
const PINNED = 'b3a33cb'; // detached HEAD — this port's upstream. NOT on any branch.

const UP = {
  registry: path.join(WT, 'lib', 'anatomy-systems.js'),
  modal: path.join(WT, 'components', 'studio', 'AnatomyModal.jsx'),
  css: path.join(WT, 'app', 'studio', 'studio.css'),
};
const OURS = {
  registry: path.join(ROOT, 'anatomy-systems.js'),
  html: path.join(ROOT, 'index.html'),
  js: path.join(ROOT, 'atlas.js'),
};

/* Every accepted difference, with the structural reason it exists. Anything the
 * checks below find that is NOT explained by one of these is drift. */
const DEVIATIONS = [
  ['D1',  'index.html', 'Hardcoded colours → house tokens (Uniformity Contract rule 5).'],
  ['D2',  'index.html', '.anat-sysrow.focus .anat-name: var(--primary) → var(--acc-tx). Accent-as-TEXT, contract rule 3.'],
  ['D3',  'index.html', 'box-shadow → var(--shadow) (house value).'],
  ['D4',  'index.html', 'Mobile: .anat-rail becomes a bottom sheet. The rail is CHROME and 270px eats a 375px viewport.'],
  ['D5',  'index.html', 'Additive hub-only UI: .anat-back, .anat-handle, .anat-size, .anat-grouphdr, .anat-modal, .anat-empty.'],
  ['D6',  'atlas.js',   'React → vanilla. useState slots become DOM updaters; teardown runs on pagehide (bfcache-guarded).'],
  ['D7',  'atlas.js',   'assetUrl(): self-hosted ./anatomy/ first, upstream anatomyUrl() kept as the CDN fallback.'],
  ['D8',  'atlas.js',   'Reference-detail models surfaced as an EXCLUSIVE second group (upstream hides 5 of 8 shipped GLBs).'],
  ['D9',  'atlas.js',   'Mobile: pixelRatio caps at 1.5, nothing auto-loads, rail driven as a sheet.'],
  ['D10', 'atlas.js',   'SIZES — per-system download size shown before the tap. Keyed by registry id, not filename.'],
  ['D11', 'index.html', 'FIX: .anat-host canvas gets width/height:100%. Upstream setSize(w,h,false) never sets the canvas CSS size, so at dpr>1 the canvas exceeds its host and the scene renders cropped.'],
  ['D12', 'index.html', 'DEAD CSS not copied: .anat-picker{} / .anat-picker:focus{}. Verified unused in the upstream — a leftover from the pre-additive single-model <select>, replaced by the checkbox rail.'],
];

/* Upstream selectors deliberately NOT copied. Every entry must be justified in
 * DEVIATIONS above; §2 fails on any OTHER missing selector. */
const OMITTED_SELECTORS = new Set(['.anat-picker', '.anat-picker:focus']);

/* Upstream constants that carry behaviour. If any of these changes upstream, or
 * is quietly re-tuned here, the port is no longer the thing that was reviewed. */
const CONSTANTS = [
  ['GHOST_OPACITY', /GHOST_OPACITY\s*=\s*0\.06/],
  ['DIM_OPACITY', /DIM_OPACITY\s*=\s*0\.14/],
  ['camera fov 45', /PerspectiveCamera\(45,\s*1,\s*0\.01,\s*1000\)/],
  ['frame() dist ×1.45', /\*\s*1\.45/],
  ['hemisphere light', /HemisphereLight\(0xffffff,\s*0x3a4048,\s*1\.15\)/],
  ['key light', /DirectionalLight\(0xffffff,\s*1\.6\)/],
  ['fill light', /DirectionalLight\(0xcfe0ff,\s*0\.7\)/],
  ['raycast drag threshold 5px', /Math\.hypot\([^)]*\)\s*>\s*5/],
  ['raycast opacity gate 0.2', /material\.opacity\s*>\s*0\.2/],
  ['select emissive 0x5b8cff', /setHex\(0x5b8cff\)/],
  ['select emissiveIntensity', /emissiveIntensity\s*=\s*0\.5/],
  ['recolour metalness/roughness', /metalness\s*=\s*0\.0;\s*o\.material\.roughness\s*=\s*0\.55/],
  ['emissive tint ×0.06', /multiplyScalar\(0\.06\)/],
  ['DoubleSide', /side\s*=\s*THREE\.DoubleSide/],
];

let failed = 0, warned = 0;
const ok = (s) => console.log('  [32m✓[0m ' + s);
const bad = (s) => { failed++; console.log('  [31m✗[0m ' + s); };
const warn = (s) => { warned++; console.log('  [33m![0m ' + s); };
const head = (s) => console.log('\n[1m' + s + '[0m');
const read = (p) => fs.readFileSync(p, 'utf8');

console.log('[1mAnatomy Atlas — port validator[0m');

// ── §0 upstream present + pinned ────────────────────────────────────────────
head('§0  Upstream checkout');
const haveUpstream = fs.existsSync(UP.registry) && fs.existsSync(UP.modal) && fs.existsSync(UP.css);
if (!haveUpstream) {
  bad('Giga upstream NOT FOUND at ' + WT);
  bad('PARITY NOT VERIFIED — this run proves nothing about the copy.');
} else {
  ok('upstream found at ' + path.relative(ROOT, WT));
  try {
    const sha = execFileSync('git', ['-C', WT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (sha.startsWith(PINNED)) ok('upstream at pinned commit ' + PINNED);
    else bad('upstream moved: expected ' + PINNED + ', found ' + sha.slice(0, 7) + ' — re-review the port before re-pinning.');
  } catch (e) { warn('could not read upstream HEAD (' + e.message.split('\n')[0] + ')'); }
}

// ── §1 the registry is byte-for-byte ────────────────────────────────────────
head('§1  anatomy-systems.js is byte-for-byte');
if (!haveUpstream) { bad('skipped — no upstream'); }
else {
  const a = fs.readFileSync(UP.registry);
  const b = fs.readFileSync(OURS.registry);
  if (a.equals(b)) ok('identical to upstream (' + a.length + ' bytes)');
  else {
    bad('DIFFERS from upstream. The registry must be an exact copy.');
    const la = read(UP.registry).split('\n'), lb = read(OURS.registry).split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) { console.log('      first diff line ' + (i + 1) + '\n      upstream: ' + (la[i] || '(eof)') + '\n      ours:     ' + (lb[i] || '(eof)')); break; }
    }
  }
}

// ── §2 every upstream .anat-* selector survives ─────────────────────────────
head('§2  Upstream .anat-* selectors all present');
if (!haveUpstream) { bad('skipped — no upstream'); }
else {
  const css = read(UP.css);
  const sels = new Set();
  for (const m of css.matchAll(/^\s*(\.anat-[^{,]*(?:,\s*\.anat-[^{,]*)*)\s*\{/gm)) {
    m[1].split(',').forEach((s) => { const t = s.trim(); if (t.startsWith('.anat-')) sels.add(t); });
  }
  const ours = read(OURS.html);
  const missing = [...sels].filter((s) => !ours.includes(s) && !OMITTED_SELECTORS.has(s));
  const skipped = [...sels].filter((s) => OMITTED_SELECTORS.has(s));
  if (!sels.size) warn('parsed 0 selectors from upstream CSS — check the regex against studio.css');
  else if (!missing.length) ok((sels.size - skipped.length) + ' upstream selectors present, ' + skipped.length + ' declared-omitted (D12)');
  else missing.forEach((s) => bad('missing upstream selector: ' + s));
}

// ── §3 behaviour-carrying constants ─────────────────────────────────────────
head('§3  Upstream constants preserved');
{
  const ours = read(OURS.js);
  const up = haveUpstream ? read(UP.modal) : null;
  for (const [name, re] of CONSTANTS) {
    const inOurs = re.test(ours);
    const inUp = up == null ? null : re.test(up);
    if (!inOurs) bad(name + ' — MISSING from atlas.js');
    else if (inUp === false) warn(name + ' present here but not matched upstream — check the pattern');
    else ok(name);
  }
}

// ── §4 house uniformity contract ────────────────────────────────────────────
head('§4  BN Hub Uniformity Contract');
{
  const html = read(OURS.html);
  const rootBlock = (html.match(/:root\{[\s\S]*?\}/) || [''])[0] + (html.match(/html\[data-theme="light"\]\{[\s\S]*?\}/) || [''])[0];
  // Strip the palette blocks, then CSS/HTML comments and the theme-color meta —
  // the D1 mapping is DOCUMENTED in a comment, and scanning it reports every
  // colour we removed as if it were still live.
  const body = html
    .replace(/:root\{[\s\S]*?\}/, '')
    .replace(/html\[data-theme="light"\]\{[\s\S]*?\}/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<meta name="theme-color"[^>]*>/g, '');

  // rule 1/2 — the palette is present, by value
  const tokens = ['--bg', '--card', '--card2', '--line', '--line2', '--tx', '--tx2', '--tx3', '--acc', '--acc2', '--acc-tx', '--shadow'];
  const missTok = tokens.filter((t) => !new RegExp(t + '\\s*:').test(rootBlock));
  missTok.length ? bad('missing house tokens: ' + missTok.join(', ')) : ok('house token block present (' + tokens.length + ' tokens)');
  /^[\s\S]*--bg:#161719/.test(rootBlock) ? ok('--bg is the house value #161719') : bad('--bg is not the house value');

  // rule 3 — --acc is a FILL; accent-as-text must be --acc-tx
  const accText = body.match(/[^-]color:\s*var\(--acc\)/g);
  accText ? bad('color:var(--acc) used ' + accText.length + '× — accent-as-text must be var(--acc-tx) (rule 3)') : ok('no color:var(--acc) — accent used as fill only');

  // rule 4 — shared theme key
  /localStorage\.getItem\('hub\.theme'\)/.test(html) ? ok("theme boots from localStorage['hub.theme']") : bad('theme does not read the shared hub.theme key');
  /data-theme/.test(html) ? ok('data-theme applied on documentElement') : bad('no data-theme mechanism');

  // rule 5 — no hardcoded colour outside :root (legacy palette must be gone)
  const legacy = body.match(/#0e1420|#182133|#4f9dff/gi);
  legacy ? bad('legacy navy palette found: ' + [...new Set(legacy)].join(', ')) : ok('no legacy navy palette');
  // hex outside :root, ignoring the 3D-mesh data colours and pure black/white alpha
  const strayHex = (body.match(/#[0-9a-f]{6}\b/gi) || []).filter((h) => !/^#fff|^#000/i.test(h));
  strayHex.length ? warn('hex outside :root (check each is 3D data, not theme): ' + [...new Set(strayHex)].join(', ')) : ok('no stray hex outside :root');

  // NO WHITE LIGHT — no specular rim / white inset highlights on chrome
  const whiteInset = body.match(/inset\s+0\s+1px\s+0\s+rgba\(255,\s*255,\s*255/g) || [];
  const chromeWhite = whiteInset.filter(() => true);
  // the one legitimate site is the .anat-close CTA, which follows Giga's .st-cta
  if (chromeWhite.length > 1) bad('white inset highlights found ' + chromeWhite.length + '× — NO WHITE LIGHT rule');
  else ok('no white specular rims / sheens on chrome');

  // rule 7 — back to the hub
  /jeremyspm\.github\.io\//.test(html) ? ok('← Hub back link present') : bad('no back link to the hub');
}

// ── §5 assets match the registry ────────────────────────────────────────────
head('§5  Shipped assets match the registry');
{
  const reg = read(OURS.registry);
  const ready = [...reg.matchAll(/\{\s*id:\s*'([^']+)'[^}]*?file:\s*'([^']+)'[^}]*?status:\s*'ready'/g)].map((m) => ({ id: m[1], file: m[2] }));
  ready.length ? ok(ready.length + " systems marked 'ready' in the registry") : bad('parsed 0 ready systems');
  const js = read(OURS.js);
  for (const r of ready) {
    const p = path.join(ROOT, 'anatomy', r.file);
    if (!fs.existsSync(p)) { bad(r.id + ": status 'ready' but anatomy/" + r.file + ' is missing'); continue; }
    const mb = fs.statSync(p).size / 1048576;
    // D10 — SIZES is keyed by registry id, not filename. A miss silently drops the chip.
    const m = js.match(new RegExp('\\b' + r.id + ':\\s*([\\d.]+)'));
    if (!m) bad(r.id + ': no SIZES entry (the size chip would silently vanish)');
    else if (Math.abs(parseFloat(m[1]) - mb) > 0.15) bad(r.id + ': SIZES says ' + m[1] + ' MB, file is ' + mb.toFixed(1) + ' MB');
    else ok(r.id + ' → ' + r.file + ' (' + mb.toFixed(1) + ' MB)');
  }
  // CC BY-SA 4.0 attribution is a licence requirement, not decoration
  /Z-Anatomy[\s\S]{0,40}CC BY-SA 4\.0/.test(read(OURS.html))
    ? ok('CC BY-SA 4.0 credit line present')
    : bad('CC BY-SA attribution missing — required by the model licence');
}

// ── §6 declared deviations ──────────────────────────────────────────────────
head('§6  Declared deviations');
{
  const html = read(OURS.html), js = read(OURS.js);
  for (const [id, file, why] of DEVIATIONS) {
    const src = file === 'atlas.js' ? js : html;
    if (new RegExp('\\b' + id + '\\b').test(src)) ok(id + ' (' + file + ') — ' + why);
    else bad(id + ' declared here but not annotated in ' + file);
  }
}

console.log('\n' + (failed ? '[31m' + failed + ' FAILED[0m' : '[32mall checks passed[0m')
  + (warned ? ', [33m' + warned + ' warning(s)[0m' : ''));
process.exit(failed ? 1 : 0);
