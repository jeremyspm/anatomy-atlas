// ════════════════════════════════════════════════════════════════════════════
// D13 — the systems Giga exported but never wired up.
//
// The upstream registry (anatomy-systems.js) ships 3 body systems `ready` and
// 7 `planned`. But the upstream worktree's own /public/anatomy holds 11 MORE
// exported Z-Anatomy GLBs — renal, digestive, endocrine, lymphatic,
// reproductive, integumentary, muscular, skeletal, joints, insertions,
// regions — produced by the same Blender export as cardiovascular.glb and
// never promoted past `status: 'planned'`. The assets existed; the registry
// row was the only thing missing.
//
// This module is that promotion, kept OUT of anatomy-systems.js so that file
// stays byte-for-byte identical to Giga's (.build/validate.js §1). It is a
// TRANSFORM of the upstream array, not a rewrite:
//   · planned ids whose GLB now ships flip to `ready` in their upstream slot,
//     keeping the upstream's ordering (nursing assessment weight);
//   · `musculoskeletal` — one planned file that was never exported as one —
//     expands in place into the four files that WERE: skeletal, joints,
//     muscular, insertions;
//   · `regions` is appended (surface anatomy has no upstream slot).
// Everything else passes through untouched.
//
// ── Why every new system needs its own scheme ────────────────────────────────
// The upstream gave each planned system `scheme: 'generic'`, which buckets by
// MATERIAL name against a musculoskeletal regex set. Run against the real
// exports that is not a rough fit, it is a null one: renal's materials are
// `Organ`/`Ductus`, lymphatic's are `Lymph-1…8`, muscular's are muscle ACTIONS
// (`Flexion`, `Abductor`). None match, so every structure lands in "Other" and
// the layer rail does nothing. Each scheme below is authored against the actual
// exported names/materials, and its bucket counts are asserted by
// .build/validate.js §7 — a scheme that stops matching its GLB fails the build
// rather than quietly degrading to one grey "Other" pile.
//
// ── Why they recolour ────────────────────────────────────────────────────────
// Z-Anatomy authors almost all of these materials as pure white (#ffffff): the
// colour lives in the .blend's viewport shading, not the export. Left alone,
// muscular/skeletal/joints/regions render as one white mass. This is the same
// trap the upstream calls out for nervous ("never left authored-white, which
// otherwise swamps a system this dense"), so these schemes classify by name and
// recolour — which also keeps the upstream's promise that a layer's swatch IS
// the colour of its structures on screen.
// ════════════════════════════════════════════════════════════════════════════

import {
  SYSTEMS as UPSTREAM_SYSTEMS,
  schemeFor as upstreamSchemeFor,
  anatomyUrl,
  isLabelMesh,
} from './anatomy-systems.js';

const ZA = 'Z-Anatomy · CC BY-SA 4.0';

// ── the newly-shipped rows ───────────────────────────────────────────────────
// `label` states real scope where the export is narrower than the system name
// promises ([[self-explaining-ui-policy]]): Z-Anatomy's default body is male, and
// its integumentary collection is hair and nails — there is no skin mesh.
const PROMOTED = {
  renal: { file: 'renal.glb', scheme: 'renal' },
  digestive: { file: 'digestive.glb', scheme: 'digestive' },
  endocrine: { file: 'endocrine.glb', scheme: 'endocrine' },
  lymphatic: { file: 'lymphatic.glb', scheme: 'lymphatic' },
  reproductive: { file: 'reproductive.glb', scheme: 'reproductive', label: 'Reproductive (male)' },
  integumentary: { file: 'integumentary.glb', scheme: 'integumentary', label: 'Integumentary (hair & nails)' },
};

// `musculoskeletal` was one planned filename; the export is four files.
const MSK = [
  { id: 'skeletal', label: 'Skeletal', file: 'skeletal.glb', scheme: 'skeletal' },
  { id: 'joints', label: 'Joints & ligaments', file: 'joints.glb', scheme: 'joints' },
  { id: 'muscular', label: 'Muscular', file: 'muscular.glb', scheme: 'muscular' },
  { id: 'insertions', label: 'Muscle attachments', file: 'insertions.glb', scheme: 'insertions' },
];

const APPENDED = [
  { id: 'regions', label: 'Surface regions', file: 'regions.glb', scheme: 'regions' },
];

const row = (s) => ({ group: 'Body systems', status: 'ready', credit: ZA, ...s });

const PROMOTED_SYSTEMS = UPSTREAM_SYSTEMS.flatMap((s) => {
  if (s.id === 'musculoskeletal') return MSK.map(row);
  const p = PROMOTED[s.id];
  return p ? [{ ...s, ...p, status: 'ready', credit: ZA }] : [s];
});

// APPENDED goes in ahead of the first Reference-detail row, so the rail keeps
// its two-group shape (Body systems, then Reference detail).
const at = PROMOTED_SYSTEMS.findIndex((s) => s.group === 'Reference detail');
export const SYSTEMS = [
  ...PROMOTED_SYSTEMS.slice(0, at < 0 ? PROMOTED_SYSTEMS.length : at),
  ...APPENDED.map(row),
  ...PROMOTED_SYSTEMS.slice(at < 0 ? PROMOTED_SYSTEMS.length : at),
];

export function getSystem(id) { return SYSTEMS.find((s) => s.id === id) || null; }

// ── layer schemes for the promoted systems ───────────────────────────────────
// Signature is classify(name, materialName). The upstream classifiers take only
// the first argument and ignore the second, so they are unaffected (D14).

/* The names these classifiers see are NOT the names in the GLB. three's
 * GLTFLoader runs every node name through PropertyBinding.sanitizeNodeName,
 * which replaces whitespace with "_" and DELETES [ ] . : / — so Z-Anatomy's
 * "Eighth rib.l" arrives as "Eighth_ribl" and "Kidney.l" as "Kidneyl".
 *
 * Two consequences, both load-bearing:
 *   · undo the "_" before matching, or every multi-word pattern silently fails;
 *   · never end a pattern in \b on a word that can be last, because the side
 *     suffix is glued straight onto it ("rib" → "ribl").
 * Material names are NOT sanitized ("Articular capsule" keeps its space) and are
 * matched as-is. .build/validate.js §7 applies the same sanitisation, so the
 * counts it asserts are the counts the browser produces. */
const norm = (s) => (s || '').toLowerCase().replace(/_/g, ' ');

const S = {};

// Renal — the tract, top to bottom.
S.renal = {
  layers: [
    { key: 'kidney', label: 'Kidneys', color: '#a5544c', hex: 0xa5544c },
    { key: 'collecting', label: 'Renal pelvis & ureters', color: '#d3a94f', hex: 0xd3a94f },
    { key: 'bladder', label: 'Bladder & urethra', color: '#7fa3c4', hex: 0x7fa3c4 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    if (/kidney/.test(n)) return 'kidney';
    if (/renal pelvis|ureter/.test(n)) return 'collecting';
    if (/bladder|urethra/.test(n)) return 'bladder';
    return 'other';
  },
};

// Digestive — peritoneum FIRST: "Meso-appendix" and "Mesocolon" carry a tract
// organ's name and would otherwise be filed as gut.
S.digestive = {
  layers: [
    { key: 'tract', label: 'GI tract', color: '#d09a5c', hex: 0xd09a5c },
    { key: 'accessory', label: 'Liver, gallbladder & pancreas', color: '#8e5b4a', hex: 0x8e5b4a },
    { key: 'salivary', label: 'Salivary glands', color: '#cbb26b', hex: 0xcbb26b },
    { key: 'peritoneum', label: 'Peritoneum & mesentery', color: '#a8bd92', hex: 0xa8bd92 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    if (/omentum|mesocolon|meso-|mesentery|peritone/.test(n)) return 'peritoneum';
    if (/parotid|sublingual|submandibular/.test(n)) return 'salivary';
    if (/liver|gallbladder|bile duct|pancrea/.test(n)) return 'accessory';
    if (/oesophag|esophag|stomach|duoden|jejun|ileum|colon|caec|cecum|rectum|anal canal|appendix|taenia|pharyn|tongue|palate|uvula|gingiva|epiglottis/.test(n)) return 'tract';
    return 'other';
  },
};

S.endocrine = {
  layers: [
    { key: 'pituitary', label: 'Pituitary & pineal', color: '#b06fa8', hex: 0xb06fa8 },
    { key: 'thyroid', label: 'Thyroid & parathyroid', color: '#6fa8b0', hex: 0x6fa8b0 },
    { key: 'adrenal', label: 'Adrenal', color: '#c98a55', hex: 0xc98a55 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    if (/hypophysis|pituitary|pineal/.test(n)) return 'pituitary';
    if (/thyroid|parathyroid/.test(n)) return 'thyroid';
    if (/suprarenal|adrenal/.test(n)) return 'adrenal';
    return 'other';
  },
};

// Lymphatic — the export is nodes plus three lymphoid organs; there are no
// lymphatic vessels or ducts in it, so no vessel layer is offered.
S.lymphatic = {
  layers: [
    { key: 'organs', label: 'Lymphoid organs', color: '#8c6fa8', hex: 0x8c6fa8 },
    { key: 'nodes', label: 'Lymph nodes', color: '#6f9c8a', hex: 0x6f9c8a },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    if (/spleen|thymus|tonsil/.test(n)) return 'organs';
    if (/node/.test(n)) return 'nodes';
    return 'other';
  },
};

S.reproductive = {
  layers: [
    { key: 'gonads', label: 'Testes & epididymis', color: '#c47f8a', hex: 0xc47f8a },
    { key: 'ducts', label: 'Ducts', color: '#d3b26a', hex: 0xd3b26a },
    { key: 'glands', label: 'Accessory glands', color: '#8fa8c4', hex: 0x8fa8c4 },
    { key: 'external', label: 'External genitalia', color: '#b06f7a', hex: 0xb06f7a },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    if (/testis|epididym|ovary/.test(n)) return 'gonads';
    if (/ductus deferens|ejaculatory duct|uterine tube/.test(n)) return 'ducts';
    if (/prostate|seminal|bulbo-urethral/.test(n)) return 'glands';
    if (/penis|glans|corpus cavernosum|corpus spongiosum|scrotum|labium|clitoris/.test(n)) return 'external';
    return 'other';
  },
};

S.integumentary = {
  layers: [
    { key: 'hair', label: 'Hair', color: '#4a4038', hex: 0x4a4038 },
    { key: 'nails', label: 'Nails', color: '#d9c9b6', hex: 0xd9c9b6 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    if (/hair|eyelash|eyebrow/.test(n)) return 'hair';
    if (/nail|perionyx/.test(n)) return 'nails';
    return 'other';
  },
};

// Skeletal — bucket by body region, which is what you actually revise by.
// Teeth and cartilage come off the MATERIAL first, because "Costal cartilage of
// eighth rib" and "Thyroid cartilage" are named for the bone/organ they serve.
S.skeletal = {
  layers: [
    { key: 'skull', label: 'Skull & face', color: '#ddc9a0', hex: 0xddc9a0 },
    { key: 'spine', label: 'Vertebral column', color: '#9db4d8', hex: 0x9db4d8 },
    { key: 'thorax', label: 'Ribs & sternum', color: '#d59aa6', hex: 0xd59aa6 },
    { key: 'upper', label: 'Upper limb', color: '#8fc4ad', hex: 0x8fc4ad },
    { key: 'lower', label: 'Lower limb', color: '#c2a3d1', hex: 0xc2a3d1 },
    { key: 'teeth', label: 'Teeth', color: '#f2efe6', hex: 0xf2efe6 },
    { key: 'cartilage', label: 'Cartilage', color: '#7fb8c4', hex: 0x7fb8c4 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n, mat) => {
    n = norm(n); mat = (mat || '').toLowerCase();
    if (/teeth/.test(mat) || /tooth|incisor|canine|molar|premolar/.test(n)) return 'teeth';
    if (/cartilage/.test(mat) || /cartilage/.test(n)) return 'cartilage';
    if (/vertebra|atlas|axis|sacrum|coccyx/.test(n)) return 'spine';
    // no trailing \b: the sanitised name is "eighth ribl", not "eighth rib"
    if (/\brib|sternum|manubrium|xiphoid/.test(n)) return 'thorax';
    if (/of hand|clavicle|scapula|humerus|radius|ulna|capitate|hamate|lunate|pisiform|scaphoid|trapezium|trapezoid|triquetrum|metacarpal/.test(n)) return 'upper';
    if (/of foot|hip bone|femur|patella|tibia|fibula|calcaneus|talus|navicular|cuboid|cuneiform|metatarsal|sesamoid/.test(n)) return 'lower';
    if (/ethmoid|frontal|parietal|occipital|temporal|sphenoid|maxilla|mandible|palatine|lacrimal|nasal|vomer|zygomatic|concha|incus|malleus|stapes|hyoid/.test(n)) return 'skull';
    return 'other';
  },
};

// Joints — the material IS the tissue here, and it is exact.
S.joints = {
  layers: [
    { key: 'ligament', label: 'Ligaments & membranes', color: '#e2d7b0', hex: 0xe2d7b0 },
    { key: 'cartilage', label: 'Cartilage & discs', color: '#7fb8c4', hex: 0x7fb8c4 },
    { key: 'capsule', label: 'Articular capsules', color: '#b9a9d1', hex: 0xb9a9d1 },
    { key: 'fat', label: 'Fat pads', color: '#d1ab59', hex: 0xd1ab59 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n, mat) => {
    mat = (mat || '').toLowerCase();
    if (/ligament/.test(mat)) return 'ligament';
    if (/cartilage/.test(mat)) return 'cartilage';
    if (/capsule/.test(mat)) return 'capsule';
    if (/fat/.test(mat)) return 'fat';
    return 'other';
  },
};

// Muscular — Z-Anatomy materials name the muscle's ACTION, so the rail becomes
// "show me every flexor", which no structure-name regex could reconstruct.
S.muscular = {
  layers: [
    { key: 'flexors', label: 'Flexors', color: '#b8323f', hex: 0xb8323f },
    { key: 'extensors', label: 'Extensors', color: '#d1544f', hex: 0xd1544f },
    { key: 'abdadd', label: 'Abductors & adductors', color: '#a04656', hex: 0xa04656 },
    { key: 'rotators', label: 'Rotators', color: '#8c2f45', hex: 0x8c2f45 },
    { key: 'muscles', label: 'Other muscles', color: '#c46a5e', hex: 0xc46a5e },
    { key: 'fascia', label: 'Fascia & bursae', color: '#b6dce6', hex: 0xb6dce6 },
    { key: 'tendon', label: 'Tendons & ligaments', color: '#e2d7b0', hex: 0xe2d7b0 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n, mat) => {
    mat = (mat || '').toLowerCase();
    if (/fascia|bursa/.test(mat)) return 'fascia';
    if (/tendon|ligament|capsule|cartilage/.test(mat)) return 'tendon';
    if (/flexion|flexor/.test(mat)) return 'flexors';
    if (/extension|extensor/.test(mat)) return 'extensors';
    if (/abductor|adductor/.test(mat)) return 'abdadd';
    if (/rotat/.test(mat)) return 'rotators';
    if (mat) return 'muscles';
    return 'other';
  },
};

// Muscle attachments — origin red / insertion blue is the textbook convention,
// and the material prefix (Origin-… / End-…) states which is which.
S.insertions = {
  layers: [
    { key: 'origin', label: 'Origins', color: '#d1544f', hex: 0xd1544f },
    { key: 'insertion', label: 'Insertions', color: '#4f8cd1', hex: 0x4f8cd1 },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n, mat) => {
    mat = (mat || '').toLowerCase();
    if (/^origin/.test(mat)) return 'origin';
    if (/^end/.test(mat)) return 'insertion';
    // the name carries the same signal: Z-Anatomy suffixes .o<n><side> / .e<n><side>
    if (/\.o\d*[lr]?$/.test(n || '')) return 'origin';
    if (/\.e\d*[lr]?$/.test(n || '')) return 'insertion';
    return 'other';
  },
};

// Surface regions — the landmarks you palpate and chart against.
// Head & neck is tested first, but note the traps: "Femoral triangle" contains
// "oral", "Temporal region" contains "oral" too — hence the anchored patterns.
S.regions = {
  layers: [
    { key: 'headneck', label: 'Head & neck', color: '#d98f6e', hex: 0xd98f6e },
    { key: 'trunk', label: 'Trunk', color: '#cfa76b', hex: 0xcfa76b },
    { key: 'upper', label: 'Upper limb', color: '#7fb0c9', hex: 0x7fb0c9 },
    { key: 'lower', label: 'Lower limb', color: '#8fbf8a', hex: 0x8fbf8a },
    { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
  ],
  classify: (n) => {
    n = norm(n);
    // no trailing \b anywhere here either — "Sole.l" sanitises to "solel"
    if (/thigh|knee|\bleg|ankle|foot|heel|\bsole|malleol|poplite|femoral|hallucial|metatarsal/.test(n)) return 'lower';
    if (/forearm|\barm|elbow|wrist|hand|\bpalm|cubital|deltoid|bicipital|foveola/.test(n)) return 'upper';
    if (/frontal|parietal|occipital|temporal|orbital|nasal|oral region|buccal|mental|zygomatic|auricul|auricle|helix|tragus|concha|scapha|antihelic|lobule|mastoid|parotideo|carotid triangle|muscular triangle|submandibular|submental|of neck|sternocleidomastoid|philtrum|labial|mentolabial|nasolabial|eyebrow|angle of mouth|cymba|eminentia|intertragic|triangular fossa|upper lip/.test(n)) return 'headneck';
    if (/thorax|pectoral|mammary|mamillary|presternal|sternal|epigastric|hypochondriac|hypogastric|umbilic|lumbar|inguinal|of abdomen|sacral|gluteal|anal region|urogenital|vertebral|scapular|axillary|clavicular|supraclavicular|deltopectoral|auscultation|median line|hip region/.test(n)) return 'trunk';
    return 'other';
  },
};

export function schemeFor(scheme) {
  const s = S[scheme];
  if (s) return { layers: s.layers, classify: s.classify, byName: true };
  return upstreamSchemeFor(scheme);
}

export { anatomyUrl, isLabelMesh };
