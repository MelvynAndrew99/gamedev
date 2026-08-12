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

export function adjacentDiscoveredTrack(entries, index, direction) {
  if (!entries.length) return null;
  const step = direction === 'previous' || direction === 'left' ? -1 : 1;
  for (let offset = 1; offset <= entries.length; offset += 1) {
    const candidate = (index + step * offset + entries.length) % entries.length;
    if (entries[candidate].discovered) return candidate;
  }
  return null;
}
