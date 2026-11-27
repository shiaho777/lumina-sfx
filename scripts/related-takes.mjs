// Monophonic similarity alone collapses opposite swipe directions. These four
// manually scoped groups also passed paired listening; keep explicit IDs addressable.
export const relatedTakes = [
  ['piston-trainer-heard-from-inside-a-shelter', 'coastal-floatplane-heard-from-inside-a-shelter'],
  ['mix-desk-channel-focus', 'equipment-wheel-slot-focus'],
  ['autumn-meadow-edge-scattered-rain-loop', 'alpine-treeline-scattered-rain-loop'],
  [
    'wooden-dinghy-at-a-dock-seen-from-below-the-waterline-loop',
    'rowboat-at-reed-bank-seen-from-below-the-waterline-loop',
  ],
];

export function distinctChoices(ranked) {
  const seen = new Set();
  return ranked.filter((item) => {
    const family = relatedTakes.find((group) => group.includes(item.id));
    if (!family) return true;
    if (seen.has(family)) return false;
    seen.add(family);
    return true;
  });
}
