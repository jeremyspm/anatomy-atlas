# Anatomy Atlas

A 3D body you can rotate, peel apart system by system, and tap to name any structure.
Part of the [BN Hub](https://jeremyspm.github.io/) Toolkit.

**Live:** https://jeremyspm.github.io/anatomy-atlas/

---

## What it is

A **port** of Giga's Anatomy surface into a standalone static tool — no build step,
no server, no account, no API. Open `index.html` from any static host.

- **Body systems** — 14 of them, sharing one coordinate space and stacking additively:
  cardiovascular, respiratory, nervous, renal, skeletal, joints, muscular, muscle
  attachments, digestive, endocrine, lymphatic, reproductive, integumentary, surface
  regions. Turn on two and they overlay in the same body, with the one you tapped last
  solid and the rest dimmed to 14%.
- **Reference detail** (skeleton, skull, hand, upper/lower limb) are higher-resolution
  regional models authored separately. They *cannot* align with the body, so opening one
  closes everything else. That constraint is in the source models, not the code.
- Tap any structure to identify it; isolate a sub-layer with **only**; keep hidden layers
  as a 6% ghost for context.

Two systems cover less than their name suggests, and the panel says so rather than
letting you hunt for something that was never exported: **Integumentary** is hair and
nails (the source has no skin mesh) and **Reproductive** is the male set (the source body
is male). **Lymphatic** is nodes plus spleen/thymus/tonsils — no vessels or ducts.

## Layout

```
index.html                 house shell + the ported .anat-* CSS
atlas.js                   the scene (ported from AnatomyModal.jsx)
anatomy-systems.js         the registry — BYTE-FOR-BYTE copy of Giga's, never edited here
anatomy-systems-extra.js   D13: promotes the 11 systems Giga exported but never wired up,
                           and gives each one a layer scheme authored against its GLB
anatomy/*.glb              19 models, 47 MB, lazy-loaded one at a time
vendor/three/              three 0.183.0 + GLTFLoader/DRACOLoader/OrbitControls + Draco decoder
.build/validate.js         the port validator (see below)
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
recolour maths); the BN Hub Uniformity Contract holds; the shipped GLBs match the registry
and none is orphaned; all 14 declared deviations are annotated in the source; and **§7 —
every layer scheme actually buckets its model**.

§7 exists because the failure it catches is silent. A scheme whose regexes stop matching
still renders perfectly — every structure just lands in "Other" and the layer rail becomes
decoration. It re-derives the buckets from each GLB and fails if a scheme puts more than
20% in "Other" or fills fewer than two layers. Crucially it reproduces **three's own
renaming** before classifying, because the names a classifier sees are not the names in
the file:

| In the GLB | What the classifier actually gets | Why |
|---|---|---|
| `Eighth rib.l` | `Eighth_ribl` | `sanitizeNodeName`: whitespace → `_`, and `[ ] . : /` deleted |
| `Kidney.l` | `Kidneyl` | same |
| `Superior lobe of right lung` | `Mesh_19` | multi-primitive node → Group named for the node, children named `Mesh_N` |

Testing the raw JSON names instead would have passed a skeletal scheme that puts 82
structures in "Other" in the real browser.

**If the Giga checkout is missing it reports `PARITY NOT VERIFIED` and exits non-zero —
it never passes quietly.**

**Upstream:** `gigastudyapp/.claude/worktrees/magical-kowalevski-1d3ceb` @ `b3a33cb`
(`components/studio/AnatomyModal.jsx`, `lib/anatomy-systems.js`, the `.anat-*` block of
`app/studio/studio.css`). That commit is a **detached HEAD on a worktree**, not on any
branch — if the worktree is ever pruned the validator will say so.

### The 14 deviations

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
| D13 | **The 11 missing systems.** Giga's own `/public/anatomy` holds renal, digestive, endocrine, lymphatic, reproductive, integumentary, muscular, skeletal, joints, insertions and regions — exported by the same Blender run as `cardiovascular.glb`, then left at `status:'planned'`, so 7 systems read "coming" while their GLB sat in the repo. `anatomy-systems-extra.js` promotes them without touching the byte-for-byte registry, and gives each a layer scheme authored against the real export (the upstream's `scheme:'generic'` matches *nothing* in them — renal's materials are `Organ`/`Ductus`, lymphatic's are `Lymph-1…8`). |
| D14 | `buildSystem` passes the material name as a 2nd argument to `byName` classifiers. Additive: upstream's three ignore it, D13's need it because Z-Anatomy puts the muscle's **action** and the joint's **tissue** in the material and the structure in the name. |

## Licence & credit

The meshes are **Z-Anatomy** and **AnatomyTOOL / Open3DModel**, used under
**[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**. The credit line in the
panel is the licence requirement — **do not remove it.** Models are displayed and recoloured
at runtime; no adapted derivative is redistributed.

## Known upstream issues (not fixed here — fixing them would be drift)

- **Respiratory shows 23 lung lobes as “Other”, and the cause is not the classifier.**
  `classifyRespiratory` matches `/lung|lobe/` and the source names *do* say
  `Superior lobe of right lung` — run the regex over the file and all 23 bucket correctly.
  The break is in `buildSystem`: the lobe nodes carry **several primitives each**, so
  three builds a Group named for the node with children named `Mesh`, `Mesh_1`, … The
  upstream line `o.name || (o.parent && o.parent.name)` is written for exactly this case
  but never reaches the fallback, because `"Mesh_19"` is truthy. One line upstream
  (`/^Mesh(_\d+)?$/.test(o.name) ? o.parent.name : o.name`) fixes it for every system at
  once — which is why it belongs upstream and not here.
- **`sanitizeNodeName` silently breaks any multi-word pattern.** three replaces whitespace
  with `_` before a classifier ever sees a name, so upstream patterns like `/spinal cord/`,
  `/conus medull/` and `/cauda equina/` cannot match — nervous files only 3 structures
  under "Cord & meninges" and 626 of 1172 under "Sense organs & other". D13's schemes
  normalise `_` back to a space; the upstream's do not. Same fix location as above.
- Structure names are Terminologia Anatomica Latin, straight from the source models, and
  are shown **as three renamed them** — `Fascia_latal` rather than `Fascia lata.l`. A
  prettify step on display belongs upstream too, since it affects every system equally.

## Not in the ⚡ study bus

Deliberately. This is a reference surface with no cards and no due counts — bidding into the
hub's study engine would put fabricated numbers in the readiness bars.
