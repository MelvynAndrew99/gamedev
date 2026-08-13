// Pure library navigation for the unlocked garage music player.

export function musicLibraryEntries(playlist, context) {
  return playlist.map((entry, index) => Object.freeze({
    ...entry,
    index,
    discovered: entry.discovered(context) === true,
  }));
}

export function moveMusicSelection(index, count, direction) {
  if (count <= 0) return 0;
  const current = Math.min(Math.max(0, Number(index) || 0), count - 1);
  const delta = direction === 'up' || direction === 'left'
    ? -1
    : direction === 'down' || direction === 'right'
      ? 1
      : 0;
  return (current + delta + count) % count;
}

export function musicListWindow(index, count, capacity = 6) {
  const total = Math.max(0, Math.floor(Number(count) || 0));
  const visibleCount = Math.max(1, Math.floor(Number(capacity) || 1));
  const selected = total <= 0
    ? 0
    : Math.min(Math.max(0, Math.floor(Number(index) || 0)), total - 1);
  const size = Math.min(total, visibleCount);
  const maximumStart = Math.max(0, total - size);
  const preferredStart = selected - Math.floor(size / 2);
  const start = Math.min(maximumStart, Math.max(0, preferredStart));
  const end = start + size;
  const thumbFraction = total > 0 ? size / total : 1;
  const scrollFraction = maximumStart > 0 ? start / maximumStart : 0;
  return Object.freeze({
    start,
    end,
    size,
    total,
    canScrollUp: start > 0,
    canScrollDown: end < total,
    thumbFraction,
    scrollFraction,
    label: total > 0 ? `${start + 1}–${end} / ${total}` : '0 / 0',
  });
}

export function adjacentDiscoveredTrack(entries, index, direction) {
  if (!entries.length) return null;
  const step = direction === 'previous' || direction === 'left' ? -1 : 1;
  for (let offset = 1; offset <= entries.length; offset += 1) {
    const candidate = (index + step * offset + entries.length) % entries.length;
    if (entries[candidate].discovered) return candidate;
  }
  return null;
}
