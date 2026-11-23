// Santa Brisa Rush — the city of Santa Brisa, generated once from a fixed seed.
// A sun-soaked coastal city: Downtown in the middle, the Marina on the east,
// Casino Row up north, the Barrio in the west, and the Boardwalk beach along
// the whole southern edge. Roads form a grid; blocks hold seeded buildings.

import { makeRng } from './rng.js';

export const WORLD_W = 3600;
export const WORLD_H = 2600;
export const BEACH_TOP = 2380;
export const ROAD_W = 92;

export const AVENUES = [320, 920, 1520, 2120, 2720, 3280];
export const STREETS = [320, 820, 1320, 1820, 2280];

const DISTRICTS = [
  { name: 'Downtown', x: 1300, y: 700, w: 1200, h: 900, tint: '#e8b64c' },
  { name: 'Marina', x: 2900, y: 900, w: 700, h: 1000, tint: '#4cc3e8' },
  { name: 'Casino Row', x: 1300, y: 100, w: 1400, h: 420, tint: '#e84c9a' },
  { name: 'Barrio', x: 100, y: 700, w: 1000, h: 1100, tint: '#8fe84c' },
  { name: 'Boardwalk', x: 100, y: 2200, w: 3400, h: 260, tint: '#f2d38a' },
];

const ROOFS = ['#c96f4a', '#7a6fb0', '#4a90c9', '#c9a24a', '#5aa87a', '#b05a7a', '#8a7a5a'];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

export function onRoad(x, y) {
  for (const ax of AVENUES) if (Math.abs(x - ax) < ROAD_W / 2 + 8) return true;
  for (const sy of STREETS) if (Math.abs(y - sy) < ROAD_W / 2 + 8) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of AVENUES) {
    const d = Math.abs(x - ax);
    if (d < bestD) {
      bestD = d;
      best = { x: ax, y, vertical: true };
    }
  }
  for (const sy of STREETS) {
    const d = Math.abs(y - sy);
    if (d < bestD) {
      bestD = d;
      best = { x, y: sy, vertical: false };
    }
  }
  return best;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const palms = [];
  const lamps = [];

  for (let bi = 0; bi < AVENUES.length - 1; bi++) {
    for (let bj = 0; bj < STREETS.length - 1; bj++) {
      const x0 = AVENUES[bi] + ROAD_W / 2 + 14;
      const x1 = AVENUES[bi + 1] - ROAD_W / 2 - 14;
      const y0 = STREETS[bj] + ROAD_W / 2 + 14;
      const y1 = STREETS[bj + 1] - ROAD_W / 2 - 14;
      const bw = x1 - x0;
      const bh = y1 - y0;
      const count = rng.int(2, 4);
      for (let k = 0; k < count; k++) {
        const w = rng.range(90, Math.min(220, bw * 0.55));
        const h = rng.range(80, Math.min(200, bh * 0.55));
        const x = rng.range(x0, x1 - w);
        const y = rng.range(y0, y1 - h);
        const district = districtAt(x + w / 2, y + h / 2);
        buildings.push({
          x, y, w, h,
          roof: rng.pick(ROOFS),
          tall: district.name === 'Downtown' && rng.chance(0.5),
          district: district.name,
        });
      }
      for (let k = 0; k < 3; k++) {
        palms.push({
          x: rng.range(x0, x1),
          y: rng.range(y0, y1),
          lean: rng.range(-0.25, 0.25),
        });
      }
    }
  }

  for (let i = 0; i < 160; i++) {
    palms.push({ x: rng.range(60, WORLD_W - 60), y: rng.range(BEACH_TOP + 20, WORLD_H - 40), lean: rng.range(-0.3, 0.3) });
  }
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      lamps.push({ x: ax + ROAD_W / 2 + 6, y: sy - ROAD_W / 2 - 6 });
      lamps.push({ x: ax - ROAD_W / 2 - 6, y: sy + ROAD_W / 2 + 6 });
    }
  }

  return {
    w: WORLD_W,
    h: WORLD_H,
    beachTop: BEACH_TOP,
    avenues: AVENUES,
    streets: STREETS,
    buildings,
    palms,
    lamps,
    districts: DISTRICTS,
  };
}

export function collidesBuilding(world, x, y, radius) {
  for (const b of world.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}

export function isBeach(world, y) {
  return y >= world.beachTop;
}
