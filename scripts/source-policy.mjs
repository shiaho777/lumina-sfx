// The caller still enforces --clean before an exact ID or a requested field ambience.
export function eligibleForIntent(sound, query) {
  if (sound.id === query.trim().toLowerCase()) return true;
  if (sound.auditionNote) return false;
  if (!sound.cleanHold) return true;
  if (sound.sourceReview !== 'field' || !sound.fieldContents?.length) return false;
  if (/\b(?:without|exclude|only|alone|no)\b/i.test(query)) return false;
  const wanted = new Set(query.toLowerCase().match(/[a-z]+/g));
  return sound.fieldContents.every((label) => wanted.has(label) || wanted.has(label + 's'));
}
