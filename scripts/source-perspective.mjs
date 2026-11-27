// Catalog evidence only, independent of the user's proposed trajectory.
export function sourcePerspective(s) {
  const words = [s.id, s.perspective, ...(s.contains??[]), ...(s.components??[])].filter(Boolean).join(' ').replaceAll('-', ' ').toLowerCase();
  return {
    local: s.mixRole === 'interface' || (s.tags ?? []).includes('cursor'),
    physicalInput:
      ((s.tags ?? []).some((t) => t === 'keyboard' || t === 'device') && (s.tags ?? []).includes('launch')) ||
      ((s.tags ?? []).includes('hardware') && (s.tags ?? []).some(t => ['stylus','mouse','keyboard','trackpad'].includes(t))),
    motion: s.perspective!=='stationary exterior emitter' && /\b(fly ?by|pass by|passby|drive by|passes|climbout beyond runway)\b/.test(words),
    distance: /\b(distant|far away|far field)\b/.test(words),
    room: /\b(canyon echo|room tail|hangar echo|corridor echo|room reverb|church reverb)\b/.test(words),
  };
}
export function geometryConflict(s, layer) {
  const p = sourcePerspective(s),
    placement = layer.placement;
  if (p.local && !p.physicalInput && (layer.acoustics || (placement && placement.kind !== 'listener')))
    return 'This interface cue follows the listener. Choose a physical world source for a located emitter.';
  if (p.motion && (placement?.path?.length || placement?.doppler))
    return 'This performance already travels. Choose a stationary take for a new path or Doppler shift.';
  if (
    p.distance &&
    (layer.acoustics?.distanceM !== undefined || placement?.position || layer.macros?.distance > 0)
  )
    return 'This performance already contains distance. Choose a close take for calculated distance.';
  if (p.room && (placement?.room || (layer.macros?.space && layer.macros.space !== 'dry')))
    return 'This performance has a recorded or designed tail. Choose a dry take for a new room.';
}

// Interpret generic ambiences only when the editor identifies their emitter and its material.
// An explicit catalog ID or a brief naming its own source always takes precedence.
export function mountedAmbience(query, label = '', viewpoint = '') {
  const part = label.toLowerCase().replaceAll('-', ' ');
  if (/^(?:(?:steady|soft|light|gentle|continuous) )?(?:rainfall|rain|shower)(?: loop)?$/i.test(query)) {
    if (/\b(?:roof|pane|window|skylight|glazing)\b/.test(part) &&
        /\b(?:roof window|skylight|glazing|glass roof|windowpane|window pane)\b/i.test(viewpoint))
      return 'rain-on-window-loop';
    if (/\broof\b/.test(part) && /\b(?:(?:tin|corrugated|metal) roof|roof of (?:tin|metal))\b/i.test(viewpoint))
      return 'rain-on-tin-roof-loop';
  }
}

export function roomForContact(sound, settings, design) {
  const point = settings.placement;
  if (!sourcePerspective(sound).physicalInput || design.scope !== 'world' ||
      !point?.position || point.kind === 'listener' || point.path || design.listener?.path ||
      point.room || point.obstruction !== undefined || settings.acoustics || settings.muffle ||
      settings.macros?.space || settings.macros?.distance !== undefined || design.macros?.space || design.macros?.distance || design.style)
    return;
  const view = design.viewpoint ?? '';
  if (!/\b(?:booth|studio|office|classroom|workroom|control room|editing room)\b/i.test(view) ||
      /\b(?:outdoors|outdoor|open air|outside|anechoic|dry|soundproof|through (?:a |the )?(?:wall|glass))\b/i.test(view))
    return;
  const ear = design.listener?.position ?? [0, 0, 0];
  const metres = Math.hypot(...point.position.map((coordinate, i) => coordinate - ear[i]));
  if (metres < 2) return;
  return {
    macros: { space: 'small_room', wetness: design.macros?.wetness ?? Math.min(0.92, 0.36 + 0.09 * metres), ...settings.macros },
    muffle: { cutoffHz: Math.round(Math.max(3900, 9200 / (1 + 0.15 * metres))), envelope: [[0, 0.8]] },
  };
}
