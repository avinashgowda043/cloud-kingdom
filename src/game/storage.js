const KEY = 'cloud-kingdom:best';

/**
 * Optional local progress storage. Private-mode browsers and blocked storage
 * must never break the game, so every call is guarded.
 */
export function loadBest() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      score: Number(parsed.score) || 0,
      coins: Number(parsed.coins) || 0,
      time: Number(parsed.time) || 0
    };
  } catch {
    return null;
  }
}

export function saveBest(record) {
  try {
    const previous = loadBest();
    if (previous && previous.score >= record.score) return previous;
    window.localStorage.setItem(KEY, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}
