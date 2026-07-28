// anatomy-systems — single source of truth for the 3D anatomy atlas.
//
// The atlas is ONE Z-Anatomy body whose systems load as toggleable layers, plus
// a few higher-detail AnatomyTOOL regional models. This module owns the registry
// (what exists / what's planned), the CDN switch, and the per-scheme layer
// classification + colouring — so AnatomyModal stays a thin viewer.
//
// Hosting: assets resolve to NEXT_PUBLIC_ANATOMY_CDN when set (Cloudinary/raw),
// else /public/anatomy. Set the env var once assets are uploaded and every model
// flips to the CDN with no code change.

const CDN = (process.env.NEXT_PUBLIC_ANATOMY_CDN || '').replace(/\/$/, '');

// Cloudinary CDN URLs (raw/upload), produced by scripts/upload-anatomy.mjs. The
// unsigned preset assigns random public_ids, so we map filename -> secure_url
// here. Registry entries keep readable filenames and resolve through this map
// first, then NEXT_PUBLIC_ANATOMY_CDN, then /public/anatomy as a local fallback.
const CDN_URLS = {
  'cardiovascular.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783272871/anatomy/cy7ov5ouxhszwjp7mc5w.glb',
  'respiratory.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783289883/anatomy/qu4drle2sxszhxydxk40.glb',
  'nervous.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783290689/anatomy/viojz08urblf4dvwsxqd.glb',
  'skeleton.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783272879/anatomy/zynwv8cgsjf86mgtlsqv.glb',
  'skull.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783272880/anatomy/ikkcjuemxufz4355rkyn.glb',
  'hand.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783272873/anatomy/pzsatjbbo8k1wbbonekc.glb',
  'upper-limb.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783272881/anatomy/m8kywekql0uk7qq4tgev.glb',
  'lower-limb.glb': 'https://res.cloudinary.com/dm947frui/raw/upload/v1783272875/anatomy/kq0dvksfuomvlt5gctgm.glb',
};

// Resolve a GLB filename to its live URL: absolute URL as-is, else the CDN map,
// else the NEXT_PUBLIC_ANATOMY_CDN base, else the /public/anatomy local copy.
export function anatomyUrl(file) {
  if (!file) return file;
  if (/^https?:\/\//i.test(file)) return file;
  if (CDN_URLS[file]) return CDN_URLS[file];
  return CDN ? `${CDN}/${file}` : `/anatomy/${file}`;
}

// The registry. `status: 'ready'` = shipped GLB; `'planned'` = on the roadmap
// (shown disabled in the picker so the BN→NP scope is legible). `scheme` picks
// the layer/colour logic below. Priority order mirrors nursing assessment weight.
export const SYSTEMS = [
  // ---- Z-Anatomy unified-body systems (the atlas) ----
  { id: 'cardio', label: 'Cardiovascular', file: 'cardiovascular.glb', scheme: 'cardio', group: 'Body systems', status: 'ready', credit: 'Z-Anatomy · CC BY-SA 4.0' },
  { id: 'respiratory', label: 'Respiratory', file: 'respiratory.glb', scheme: 'respiratory', group: 'Body systems', status: 'ready', credit: 'Z-Anatomy · CC BY-SA 4.0' },
  { id: 'nervous', label: 'Nervous & sense organs', file: 'nervous.glb', scheme: 'nervous', group: 'Body systems', status: 'ready', credit: 'Z-Anatomy · CC BY-SA 4.0' },
  { id: 'renal', label: 'Renal / urinary', file: 'renal.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  { id: 'musculoskeletal', label: 'Musculoskeletal', file: 'musculoskeletal.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  { id: 'digestive', label: 'Digestive / GI', file: 'digestive.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  { id: 'endocrine', label: 'Endocrine', file: 'endocrine.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  { id: 'lymphatic', label: 'Lymphatic / immune', file: 'lymphatic.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  { id: 'reproductive', label: 'Reproductive', file: 'reproductive.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  { id: 'integumentary', label: 'Integumentary', file: 'integumentary.glb', scheme: 'generic', group: 'Body systems', status: 'planned' },
  // ---- AnatomyTOOL / Open3DModel higher-detail regional models ----
  { id: 'skeleton', label: 'Skeleton (full)', file: 'skeleton.glb', scheme: 'generic', group: 'Reference detail', status: 'ready', credit: 'Open3DModel / AnatomyTOOL · CC BY-SA 4.0' },
  { id: 'skull', label: 'Skull', file: 'skull.glb', scheme: 'generic', group: 'Reference detail', status: 'ready', credit: 'Open3DModel / AnatomyTOOL · CC BY-SA 4.0' },
  { id: 'hand', label: 'Hand', file: 'hand.glb', scheme: 'generic', group: 'Reference detail', status: 'ready', credit: 'Open3DModel / AnatomyTOOL · CC BY-SA 4.0' },
  { id: 'upperlimb', label: 'Upper limb', file: 'upper-limb.glb', scheme: 'generic', group: 'Reference detail', status: 'ready', credit: 'Open3DModel / AnatomyTOOL · CC BY-SA 4.0' },
  { id: 'lowerlimb', label: 'Lower limb', file: 'lower-limb.glb', scheme: 'generic', group: 'Reference detail', status: 'ready', credit: 'Open3DModel / AnatomyTOOL · CC BY-SA 4.0' },
];

export const READY_SYSTEMS = SYSTEMS.filter((s) => s.status === 'ready');
export function getSystem(id) { return SYSTEMS.find((s) => s.id === id) || null; }

// ---- layer schemes --------------------------------------------------------
// Cardiovascular: split by what the structure IS (arteries / veins / heart) —
// the same name logic colours the meshes, so a layer's colour == its structures.
export const CARDIO_LAYERS = [
  { key: 'arteries', label: 'Arteries', color: '#d12b3a', hex: 0xd12b3a },
  { key: 'veins', label: 'Veins', color: '#2f6fd8', hex: 0x2f6fd8 },
  { key: 'heart', label: 'Heart chambers & valves', color: '#c75b6a', hex: 0xc75b6a },
  { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
];
export function classifyCardio(name) {
  const n = (name || '').toLowerCase();
  if (/ventricle|atrium|atrial|valve|leaflet|papillary|septum|myocard|endocard|cardiac|heart/.test(n)) return 'heart';
  if (/vein|vena|venous|sinus|venule|jugular|cava|azygos|plexus/.test(n)) return 'veins';
  if (/arter|aorta|aortic|trunk|arteriole|carotid|iliac|femoral|basilar|cerebral|coronary|brachial|radial|ulnar|popliteal|tibial|subclavian/.test(n)) return 'arteries';
  return 'other';
}

// Nervous: brain/brainstem, cord+meninges, peripheral nerves, ganglia/plexuses,
// and everything else (sense organs, nuclei, tracts) as a muted grey — never
// left authored-white, which otherwise swamps a system this dense.
export const NERVOUS_LAYERS = [
  { key: 'brain', label: 'Brain & brainstem', color: '#dcc9ad', hex: 0xdcc9ad },
  { key: 'cord', label: 'Cord & meninges', color: '#b9a9d1', hex: 0xb9a9d1 },
  { key: 'nerves', label: 'Peripheral nerves', color: '#f2c14e', hex: 0xf2c14e },
  { key: 'ganglia', label: 'Ganglia & plexuses', color: '#e08a3c', hex: 0xe08a3c },
  { key: 'other', label: 'Sense organs & other', color: '#8fa0b0', hex: 0x8fa0b0 },
];
export function classifyNervous(name) {
  const n = (name || '').toLowerCase();
  if (/nucleus|tract|cortex|cerebr|cerebell|thalam|hypothal|\bpons\b|medulla|midbrain|collicul|olive|pyramid|gyrus|sulcus|commissure|fornix|hippocamp|amygdal|corpus|\bcapsule\b|ventricle|aqueduct|substantia|encephal|diencephal|mesencephal|\bbrain/.test(n)) return 'brain';
  if (/spinal cord|dura|arachnoid|\bpia\b|mening|filum|conus medull|cauda equina/.test(n)) return 'cord';
  if (/ganglion|plexus/.test(n)) return 'ganglia';
  if (/nerve|ramus|rootlet|\broot\b|nervous/.test(n)) return 'nerves';
  return 'other';
}

// Z-Anatomy group-label objects (the floating "System name" text, suffixed ".g",
// and "A & B" title labels) get exported as geometry — strip them on load.
export function isLabelMesh(name) {
  // Z-Anatomy's system-label text meshes are the only names carrying "&"
  // (e.g. "Nervous system & Sense organs.g"); real structures never do.
  return (name || '').includes('&');
}

// Respiratory: lungs (lobes) / airways (bronchi + trachea) / pleura, by name.
export const RESPIRATORY_LAYERS = [
  { key: 'lungs', label: 'Lungs (lobes)', color: '#e39aa6', hex: 0xe39aa6 },
  { key: 'airways', label: 'Airways (bronchi/trachea)', color: '#d9c07a', hex: 0xd9c07a },
  { key: 'pleura', label: 'Pleura', color: '#9fb8c9', hex: 0x9fb8c9 },
  { key: 'other', label: 'Other', color: '#9aa7b4', hex: null },
];
export function classifyRespiratory(name) {
  const n = (name || '').toLowerCase();
  if (/pleura/.test(n)) return 'pleura';
  if (/bronch|trachea|laryn|airway/.test(n)) return 'airways';
  if (/lung|lobe/.test(n)) return 'lungs';
  return 'other';
}

// Generic (musculoskeletal / AnatomyTOOL): bucket by material name.
export const GENERIC_LAYERS = [
  { key: 'skeletal', label: 'Skeletal', color: '#e8e2d0', test: /bone|phalanx|metacarp|metatars|carpal|tarsal|cuneiform|cuboid|navicular|calcaneus|talus|radius|ulna|humerus|femur|tibia|fibula|patella|clavicle|scapula|sternum|rib|vertebra|atlas|axis|sacrum|coccyx|hip|ilium|ischium|pubis|mandible|maxilla|vomer|ethmoid|sphenoid|occipital|parietal|frontal|temporal|zygomat|palatine|lacrimal|concha|hyoid|capitate|hamate|lunate|pisiform|scaphoid|trapez|triquetrum|sesamoid|incisor|canine|molar|premolar|tooth|teeth|cranium|skull/i },
  { key: 'muscular', label: 'Muscular', color: '#b23a48', test: /muscle/i },
  { key: 'tendon', label: 'Tendons & sheaths', color: '#e4d6a7', test: /tendon|sheath|hood|retinacul|aponeuros|fibrous/i },
  { key: 'vascular', label: 'Vessels', color: '#c1121f', test: /vein|artery|arterial|venous|vascul/i },
  { key: 'nervous', label: 'Nervous', color: '#f2c14e', test: /nerve/i },
  { key: 'connective', label: 'Connective & joints', color: '#7bd3c6', test: /fascia|cartilage|disc|capsule|joint|bursa|synovial|overlay|radiocarpal/i },
  { key: 'other', label: 'Other', color: '#9aa7b4', test: null },
];
export function classifyGeneric(matName) {
  for (const s of GENERIC_LAYERS) if (s.test && s.test.test(matName || '')) return s.key;
  return 'other';
}

// Return the layer set + classifier + name-source for a scheme. Cardio/nervous
// classify by the object's NAME (Z-Anatomy names precisely); generic by material.
export function schemeFor(scheme) {
  if (scheme === 'cardio') return { layers: CARDIO_LAYERS, classify: classifyCardio, byName: true };
  if (scheme === 'respiratory') return { layers: RESPIRATORY_LAYERS, classify: classifyRespiratory, byName: true };
  if (scheme === 'nervous') return { layers: NERVOUS_LAYERS, classify: classifyNervous, byName: true };
  return { layers: GENERIC_LAYERS, classify: classifyGeneric, byName: false };
}
