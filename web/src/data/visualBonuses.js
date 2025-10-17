import { getFirebaseStorage } from '../firebase.js';
import { ref, getDownloadURL } from 'firebase/storage';

// Build storage key stem from tournament, round, question number.
// Naming convention: <tournament-name>-<round-name>-<question-number>
// Normalize by slugifying: lowercase, replace non-alphanum with single dash.
function slug(v) {
  return String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function buildKeyStem(tournament, round, qnum) {
  return `${slug(tournament)}-${slug(round)}-${slug(qnum)}`;
}

// Returns a download URL if the image exists, otherwise null.
export async function getVisualBonusUrl({ tournament, round, question_number }) {
  const storage = getFirebaseStorage();
  const stem = buildKeyStem(tournament, round, question_number);
  // Try common extensions and a couple optional prefixes in case images are grouped
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];
  const prefixes = ['', 'visuals/', 'visual-bonuses/'];
  for (const prefix of prefixes) {
    for (const ext of exts) {
      try {
        const r = ref(storage, `${prefix}${stem}${ext}`);
        const url = await getDownloadURL(r);
        if (url) return url;
      } catch {
        // continue
      }
    }
  }
  return null;
}

// Heuristic to detect if a question is a visual bonus based on common field names.
export function isVisualBonus(q) {
  if (!q) return false;
  const truthy = (v) => {
    if (v === true) return true;
    const s = String(v ?? '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  };
  const fields = [
    'is_visual_bonus', 'visual_bonus', 'is_visual', 'has_visual',
    'visualBonus', 'visualbonus', 'hasVisual', 'has_visual_bonus', 'visual'
  ];
  for (const f of fields) {
    if (f in q && truthy(q[f])) return true;
  }
  // Presence of image fields can also hint
  if (q.image || q.image_url || q.img || q.picture) return true;
  return false;
}
