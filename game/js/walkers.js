// Santa Brisa Rush — pedestrians on the sidewalks of Santa Brisa.
// They stroll between waypoints, chat in pairs, and scatter in panic when a
// gun goes off or a car comes at them. Knocking one down is a crime.

import { makeRng, clamp, angleTo, dist } from './rng.js';
import { nearestRoadPoint, collidesBuilding } from './city.js';

const SHIRTS = ['#e84c4c', '#4c8fe8', '#e8c94c', '#7ae84c', '#e84cd8', '#4ce8d0', '#f2f2f2', '#ff9a3d'];
const SKINS = ['#f2c89a', '#d9a06a', '#a06a3d', '#8a5a2d', '#f7d7b0'];

export function spawnWalkers(world, rng, count) {
  const walkers = [];
  for (let i = 0; i < count; i++) {
    const spot = nearestRoadPoint(
      rng.range(120, world.w - 120),
      rng.range(120, world.beachTop - 80),
    );
    const side = rng.chance(0.5) ? 1 : -1;
    const x = spot.vertical ? spot.x + side * 62 : spot.x + rng.range(-300, 300);
    const y = spot.vertical ? spot.y + rng.range(-300, 300) : spot.y + side * 62;
    walkers.push({
      x: clamp(x, 40, world.w - 40),
      y: clamp(y, 40, world.beachTop - 20),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(24, 46),
      shirt: rng.pick(SHIRTS),
      skin: rng.pick(SKINS),
      panic: 0,
      down: 0,
      target: null,
      wait: rng.range(0, 4),
    });
  }
  return walkers;
}

function pickStrollTarget(w, world, rng) {
  const spot = nearestRoadPoint(w.x + rng.range(-420, 420), w.y + rng.range(-420, 420));
  const side = rng.chance(0.5) ? 1 : -1;
  const x = spot.vertical ? spot.x + side * 62 : spot.x + rng.range(-260, 260);
  const y = spot.vertical ? spot.y + rng.range(-260, 260) : spot.y + side * 62;
  return { x: clamp(x, 40, world.w - 40), y: clamp(y, 40, world.beachTop - 20) };
}

export function scareWalkers(walkers, x, y, radius) {
  for (const w of walkers) {
    if (w.down > 0) continue;
    if (dist(w.x, w.y, x, y) < radius) {
      w.panic = 3;
      w.angle = angleTo(x, y, w.x, w.y);
    }
  }
}

export function updateWalkers(G, dt) {
  const { world, rng } = G;
  for (const w of G.walkers) {
    if (w.down > 0) {
      w.down -= dt;
      continue;
    }
    if (w.panic > 0) {
      w.panic -= dt;
      const px = w.x + Math.cos(w.angle) * w.speed * 2.6 * dt;
      const py = w.y + Math.sin(w.angle) * w.speed * 2.6 * dt;
      if (!collidesBuilding(world, px, py, 8)) {
        w.x = clamp(px, 30, world.w - 30);
        w.y = clamp(py, 30, world.beachTop - 14);
      }
      continue;
    }
    if (w.wait > 0) {
      w.wait -= dt;
      continue;
    }
    if (!w.target) w.target = pickStrollTarget(w, world, rng);
    const d = dist(w.x, w.y, w.target.x, w.target.y);
    if (d < 12) {
      w.target = null;
      w.wait = rng.range(1, 5);
      continue;
    }
    const a = angleTo(w.x, w.y, w.target.x, w.target.y);
    w.angle = a;
    const nx = w.x + Math.cos(a) * w.speed * dt;
    const ny = w.y + Math.sin(a) * w.speed * dt;
    if (!collidesBuilding(world, nx, ny, 8)) {
      w.x = nx;
      w.y = ny;
    } else {
      w.target = null;
    }
  }
}

export function knockDownWalker(w) {
  if (w.down > 0) return false;
  w.down = 6;
  w.panic = 0;
  return true;
}
