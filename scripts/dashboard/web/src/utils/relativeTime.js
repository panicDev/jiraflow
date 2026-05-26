/**
 * Korean relative time in the form "just now / 12 seconds ago / 3 minutes ago / 2 hours ago / 5 days ago".
 *
 * @param {string|null|undefined} iso
 * @param {number} [nowMs]
 * @returns {string}
 */
export function formatRelative(iso, nowMs = Date.now()) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diffSec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec} seconds ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}
