# Anatomy Atlas

A 3D body you can rotate, peel apart system by system, and tap to name any structure.
Part of the [BN Hub](https://jeremyspm.github.io/) Toolkit.

**Live:** https://jeremyspm.github.io/anatomy-atlas/ *(pending first push)*

---

## What it is

A **port** of Giga's Anatomy surface into a standalone static tool — no build step,
no server, no account, no API. Open `index.html` from any static host.

- **Body systems** (cardiovascular, respiratory, nervous) share one coordinate space and
  stack additively — turn on two and they overlay in the same body, with the one you
  tapped last solid and the rest dimmed to 14%.
- **Reference detail** (skeleton, skull, hand, upper/lower limb) are higher-resolution
  regional models authored separately. They *cannot* align with the body, so opening one
  closes everything else. That constraint is in the source models, not the code.
- Tap any structure to identify it; isolate a sub-layer with **only**; keep hidden layers
  as a 6% ghost for context.

Seven more body systems (renal, musculoskeletal, digestive, endocrine, lymphatic,
reproductive, integumentary) are in the registry as `planned` and show disabled, so the
roadmap stays legible.

## Layout

```
index.html              house shell + the ported .anat-* CSS
atlas.js                the scene (ported from AnatomyModal.jsx)
anatomy-systems.js      the registry — BYTE-FOR-BYTE copy of Giga's
anatomy/*.glb           8 models, 33 MB, lazy-loaded one at a time
vendor/three/           three 0.183.0 + GLTFLoader/DRACOLoader/OrbitControls + Draco decoder
.build/validate.js      the port validator (see below)
```

Nothing is fetched from a CDN at runtime — three, the Draco decoder and every model are
self-hosted, so the atlas keeps working offline once the browser has cached them.

## This is a port, not a rewrite

House rule: when a surface already works somewhere else, the deliverable is a **copy**,
and a prose spec always drifts — only a diff holds it honest.

```bash
node .build/validate.js
```

Checks, in order: the upstream is present and at its **pinned commit**; `anatomy-systems.js`
is byte-identical; every upstream `.anat-*` selector survives; 14 behaviour-carrying
constants are unchanged (ghost/dim opacity, camera framing, raycast thresholds, the
recolour maths); the BN Hub Uniformity Contract holds; the shipped GLBs match the registry;
and all 12 declared deviations are annotated in the source.

**If the Giga checkout is missing it reports `PARITY NOT VERIFIED` and exits non-zero —
it never passes quietly.**

**Upstream:** `gigastudyapp/.claude/worktrees/magical-kowalevski-1d3ceb` @ `b3a33cb`
(`components/studio/AnatomyModal.jsx`, `lib/anatomy-systems.js`, the `.anat-*` block of
`app/studio/studio.css`). That commit is a **detached HEAD on a worktree**, not on any
branch — if the worktree is ever pruned the validator will say so.

### The 12 deviations

| # | What |
|---|---|
| D1–D3 | Hardcoded colours → house tokens; `--primary`-as-text → `--acc-tx`; house `--shadow`. |
| D4 | Mobile: the rail becomes a **bottom sheet**. The rail is *chrome*, and 270px eats a 375px viewport. |
| D5 | Additive hub UI: back link, sheet handle, size chips, group headers, the `?` explainer. |
| D6 | React → vanilla; teardown on `pagehide`, guarded on `persisted` so a bfcache restore doesn't leave a dead canvas. |
| D7 | `assetUrl()` prefers the self-hosted copy; Giga's `anatomyUrl()` stays byte-for-byte as the CDN fallback. |
| D8 | Reference-detail models **surfaced** as an exclusive second group — upstream renders body systems only, hiding 5 of the 8 shipped GLBs (22 MB unreachable). |
| D9 | Mobile: pixel ratio caps at 1.5, and **nothing auto-loads**. |
| D10 | Each system shows its download size before you tap it. |
| D11 | **Bug fix.** `setSize(w,h,false)` never sets the canvas CSS size, so at dpr > 1 the canvas rendered larger than its host and the scene was cropped off-centre. Invisible on a dpr-1 desktop; wrong on every phone. |
| D12 | `.anat-picker` not copied — verified dead upstream. |

## Licence & credit

The meshes are **Z-Anatomy** and **AnatomyTOOL / Open3DModel**, used under
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. The credit line in the
panel is the licence requirement — **do not remove it.** Models are displayed and recoloured
at runtime; no adapted derivative is redistributed.

## Known upstream issues (not fixed here — fixing them would be drift)

- **Respiratory has no “Lungs (lobes)” layer in practice.** `classifyRespiratory` matches
  `/lung|lobe/` on the structure name, but the shipped mesh names put the lobes in *Other*
  (29 airways / 1 pleura / 23 other, 0 lungs). Re-tuning the classifier belongs upstream,
  against the whole corpus.
- Structure names are Terminologia Anatomica Latin, straight from the source models.

## Not in the ⚡ study bus

Deliberately. This is a reference surface with no cards and no due counts — bidding into the
hub's study engine would put fabricated numbers in the readiness bars.
