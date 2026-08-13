// Pure presentation rules for the integrated garage. Keeping these outside
// Phaser gives controller/pointer views one source of truth for product state.

export function garageItemBadge(action, money = 0) {
  if (action?.badge) return action.badge;
  if (action?.locked) return 'LOCKED';
  if (action?.jukebox && action?.owned) return 'NOW PLAYING';
  if (action?.armed) return 'NEXT RACE';
  if (action?.equipped) return 'EQUIPPED';
  if (action?.owned) return 'OWNED';
  if (action?.cost === 0 && action?.icon === 'repair') return 'HULL FULL';
  if (action?.cost != null && money < action.cost) return 'FUNDS LOW';
  if (action?.perRace) return 'PER RACE';
  return action?.cost == null ? 'READY' : `$${action.cost}`;
}

export function garageActionBlocked(action) {
  return Boolean(
    action?.locked ||
    (action?.owned && !action?.jukebox) ||
    action?.armed ||
    (action?.cost === 0 && action?.icon === 'repair'),
  );
}
