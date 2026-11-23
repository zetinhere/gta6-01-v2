// peds.js — the people of Solmara: shoppers, beachgoers and commuters who
// stroll the sidewalks, scatter when a gun goes off, and occasionally get in
// the way of a getaway.
import { RNG, clamp, dist } from './util.js';

const SHIRTS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#6c5ce7', '#ff9f43', '#00b894', '#e17055', '#74b9ff'];
const PANTS = ['#2d3436', '#636e72', '#6c5ce7', '#2f3542', '#57606f'];

export function makePed(world, rng, nearX, nearY) {
  const x = clamp(nearX + rng.range(-420, 420), 40, 2920);
  const y = clamp(nearY + rng.range(-320, 320), 40, 2360);
  return {
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: rng.range(26, 48),
    shirt: rng.pick(SHIRTS), pants: rng.pick(PANTS),
    state: 'walk', // walk | flee | down
    tx: x, ty: y, wait: rng.range(0, 3), down: 0,
  };
}

// Pick a new stroll target on a sidewalk: just off a road centreline.
function strollTarget(world, rng, ped) {
  const vertical = rng.chance(0.5);
  if (vertical) {
    const vx = world.nodes[Math.floor(rng.next() * world.nodes.length)].x;
    return { x: vx + (rng.chance(0.5) ? 44 : -44), y: clamp(ped.y + rng.range(-320, 320), 40, 2360) };
  }
  const hy = world.nodes[Math.floor(rng.next() * world.nodes.length)].y;
  return { x: clamp(ped.x + rng.range(-320, 320), 40, 2920), y: hy + (rng.chance(0.5) ? 44 : -44) };
}

export function updatePeds(peds, dt, world, rng, player, gunshot) {
  for (const p of peds) {
    if (p.state === 'down') { p.down -= dt; if (p.down <= 0) p.state = 'walk'; continue; }
    if (gunshot || (player && player.mode === 'car' && dist(p.x, p.y, player.x, player.y) < 90 && Math.abs(player.speed || 0) > 200)) {
      p.state = 'flee';
    }
    if (p.state === 'flee') {
      const away = Math.atan2(p.y - (player ? player.y : 0), p.x - (player ? player.x : 0));
      p.angle = away;
      p.x += Math.cos(away) * 95 * dt;
      p.y += Math.sin(away) * 95 * dt;
      p.wait -= dt;
      if (p.wait <= 0) { p.state = 'walk'; p.wait = rng.range(1, 4); }
    } else {
      if (p.wait > 0) { p.wait -= dt; continue; }
      const d = dist(p.x, p.y, p.tx, p.ty);
      if (d < 12) {
        const t = strollTarget(world, rng, p);
        p.tx = t.x; p.ty = t.y; p.wait = rng.chance(0.3) ? rng.range(1, 4) : 0;
        continue;
      }
      p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
    const fixed = world.resolveBuildings(p.x, p.y, 8);
    p.x = fixed.x; p.y = fixed.y;
    p.x = clamp(p.x, 24, 2920); p.y = clamp(p.y, 24, 2376);
  }
}

// A car hitting a pedestrian knocks them down and raises the heat.
export function hitPed(ped, cars) {
  for (const c of cars) {
    if (ped.state === 'down') continue;
    if (dist(ped.x, ped.y, c.x, c.y) < 26 && Math.abs(c.speed) > 60) {
      ped.state = 'down'; ped.down = 4;
      return true;
    }
  }
  return false;
}
