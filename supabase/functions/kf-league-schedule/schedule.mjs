// Players provide absolute time windows for one round. Participant order is
// drawn once per group and preserved for all eighteen rounds.
export function scheduleRound(players, previous, announcedAt, closesAt) {
  const quarter = 15 * 60 * 1000;
  const first = Math.ceil((announcedAt + quarter) / quarter) * quarter;
  const existing = new Set(previous.map(m => JSON.stringify([m.host, m.guest])));
  const edges = players.map(() => []);
  for (let a = 0; a < players.length; a++) {
    for (let b = a + 1; b < players.length; b++) {
      const pa = players[a], pb = players[b];
      // Alternate the first-leg host around the group's drawn seat order.
      let host = (b - a) % 2 ? pa : pb;
      let guest = host === pa ? pb : pa;
      if (existing.has(JSON.stringify([host.id, guest.id]))) [host, guest] = [guest, host];
      if (existing.has(JSON.stringify([host.id, guest.id]))) continue;
      const slots = [];
      for (let t = first; t + quarter <= closesAt; t += quarter) {
        if ([pa, pb].every(p => p.windows.some(([start, end]) => start <= t && t + quarter <= end))) slots.push(t);
      }
      if (slots.length) edges[a].push({a, b, host:host.id, guest:guest.id, slots});
    }
  }
  // At most 10 seats. Enumerate pairings; for each, match games to distinct
  // slots first. Reuse a slot only when necessary to keep all games.
  let best = [], distinct = 0, cost = Infinity;
  function consider(pairs) {
    if (pairs.length < best.length) return;
    const owners = new Map();
    function assign(i, seen) {
      for (const slot of pairs[i].slots) {
        if (seen.has(slot)) continue;
        seen.add(slot);
        if (!owners.has(slot) || assign(owners.get(slot), seen)) {
          owners.set(slot, i);
          return true;
        }
      }
      return false;
    }
    pairs.forEach((_, i) => assign(i, new Set()));
    const times = pairs.map(pair => pair.slots[0]);
    for (const [slot, i] of owners) times[i] = slot;
    const total = times.reduce((sum,t) => sum + t - first, 0);
    if (pairs.length === best.length && (owners.size < distinct || (owners.size === distinct && total >= cost))) return;
    best = pairs.map(({host, guest},i) => ({host,guest,start:times[i]}));
    distinct = owners.size;
    cost = total;
  }
  function visit(mask, pairs) {
    let a = 0;
    while (a < players.length && mask & (1 << a)) a++;
    if (a === players.length) return consider(pairs);
    if (pairs.length + Math.floor((players.length-a)/2) < best.length) return;
    const used = mask | (1 << a);
    for (const edge of edges[a]) {
      if (!(used & (1 << edge.b))) visit(used | (1 << edge.b), [...pairs,edge]);
    }
    visit(used,pairs);
  }
  visit(0, []);
  return best;
}
