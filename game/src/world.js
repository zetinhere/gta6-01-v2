// world.js — Solmara: a sun-soaked coastal city, generated once from a seed.
//
// Layout: a road grid over 3200x2400 px. The sea runs down the east edge with
// a sandy beach and Ocean Drive; five districts give each part of town its
// own palette. Everything is deterministic: same seed, same city.
import { RNG, clamp } from './util.js';

export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 64;
export const SEA_X = 2960;      // east of this is water
export const BEACH_X = 2780;    // sand starts here
export const OCEAN_DRIVE_X = 2720;

// Vertical road centrelines (the last is Ocean Drive, the beachfront road).
export const ROADS_V = [192, 576, 960, 1344, 1728, 2112, 2496, OCEAN_DRIVE_X];
// Horizontal road centrelines.
export const ROADS_H = [144, 432, 720, 1008, 1296, 1584, 1872, 2160];

const DISTRICTS = {
  oldTown:   { name: 'Old Town',    palette: ['#e8a06a', '#d98d5f', '#c97e52', '#e0b183', '#b96f4e'] },
  downtown:  { name: 'Downtown',    palette: ['#7fb3d5', '#5d9bc4', '#8ec6e8', '#a8c8e0', '#6fa8c9'] },
  marina:    { name: 'Marina',      palette: ['#7fb8a4', '#5fa08d', '#8fc4b2', '#6aae9b', '#4f8f7d'] },
  heights:   { name: 'Palm Heights',palette: ['#f2e3c6', '#e8d3a8', '#f7ead0', '#e3cfa0', '#efe0bb'] },
  ocean:     { name: 'Ocean Drive', palette: ['#f7a8c4', '#ffd166', '#7fe3d0', '#ff9e7d', '#c4b5fd'] },
};

function districtAt(x, y) {
  if (x >= 2496) return DISTRICTS.ocean;
  if (y < 1008) return x < 960 ? DISTRICTS.oldTown : DISTRICTS.downtown;
  return x < 960 ? DISTRICTS.marina : DISTRICTS.heights;
}

export function genWorld(seed) {
  const rng = new RNG(seed);
  const buildings = [];
  const palms = [];
  const trees = [];
  const parks = [];
  const lamps = [];

  // Blocks sit between neighbouring roads.
  for (let i = 0; i < ROADS_V.length - 1; i++) {
    for (let j = 0; j < ROADS_H.length - 1; j++) {
      const x0 = ROADS_V[i] + ROAD_W / 2 + 10;
      const x1 = ROADS_V[i + 1] - ROAD_W / 2 - 10;
      const y0 = ROADS_H[j] + ROAD_W / 2 + 10;
      const y1 = ROADS_H[j + 1] - ROAD_W / 2 - 10;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      // A few blocks are parks, never buildings.
      if (rng.chance(0.12)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rng.int(3, 6);
        for (let k = 0; k < n; k++) trees.push({ x: rng.range(x0 + 14, x1 - 14), y: rng.range(y0 + 14, y1 - 14), r: rng.range(9, 15) });
        continue;
      }
      const n = d === DISTRICTS.downtown ? rng.int(1, 2) : rng.int(2, 4);
      for (let k = 0; k < n; k++) {
        const bw = rng.range(46, Math.min(120, (x1 - x0) / 1.4));
        const bh = rng.range(40, Math.min(100, (y1 - y0) / 1.4));
        const bx = rng.range(x0, Math.max(x0 + 1, x1 - bw));
        const by = rng.range(y0, Math.max(y0 + 1, y1 - bh));
        const tall = d === DISTRICTS.downtown;
        buildings.push({
          x: bx, y: by, w: bw, h: bh,
          color: rng.pick(d.palette),
          roof: tall ? '#3d5a74' : '#8a6f55',
          tall, floors: tall ? rng.int(3, 6) : rng.int(1, 2),
          district: d.name,
        });
      }
      // Palms line the beachfront and dot the Heights.
      if (d === DISTRICTS.ocean || (d === DISTRICTS.heights && rng.chance(0.5))) {
        const nP = rng.int(2, 5);
        for (let k = 0; k < nP; k++) palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(10, 14) });
      }
    }
  }
  // A palm avenue down both sides of Ocean Drive.
  for (let y = 180; y < WORLD_H - 120; y += 120) {
    palms.push({ x: OCEAN_DRIVE_X - 52, y: y + 30, r: 12 });
    palms.push({ x: OCEAN_DRIVE_X + 52, y: y + 90, r: 12 });
  }
  // Street lamps at every intersection.
  for (const vx of ROADS_V) for (const hy of ROADS_H) lamps.push({ x: vx - ROAD_W / 2 - 6, y: hy - ROAD_W / 2 - 6 });

  // Road graph: nodes at intersections, edges to the next node each way.
  const nodes = [];
  const nodeAt = {};
  for (const vx of ROADS_V) for (const hy of ROADS_H) {
    const id = nodes.length;
    nodes.push({ x: vx, y: hy });
    nodeAt[vx + ',' + hy] = id;
  }
  const edges = nodes.map(() => []);
  for (let i = 0; i < ROADS_V.length; i++) {
    for (let j = 0; j < ROADS_H.length; j++) {
      const id = nodeAt[ROADS_V[i] + ',' + ROADS_H[j]];
      if (i + 1 < ROADS_V.length) edges[id].push(nodeAt[ROADS_V[i + 1] + ',' + ROADS_H[j]]);
      if (i > 0) edges[id].push(nodeAt[ROADS_V[i - 1] + ',' + ROADS_H[j]]);
      if (j + 1 < ROADS_H.length) edges[id].push(nodeAt[ROADS_V[i] + ',' + ROADS_H[j + 1]]);
      if (j > 0) edges[id].push(nodeAt[ROADS_V[i] + ',' + ROADS_H[j - 1]]);
    }
  }

  const world = {
    buildings, palms, trees, parks, lamps, nodes, edges,
    // Named places the missions and the HUD point at.
    places: {
      hotel:    { x: 1344, y: 720, label: 'Hotel Solmara' },
      garage:   { x: 576, y: 1584, label: "Rico's Garage" },
      safehouse:{ x: 2112, y: 1872, label: 'Safehouse' },
      marina:   { x: 192, y: 2160, label: 'Marina' },
      pier:     { x: 2850, y: 1008, label: 'Pier' },
      market:   { x: 960, y: 432, label: 'Old Market' },
      stadium:  { x: 1728, y: 432, label: 'Stadium' },
      beach:    { x: 2860, y: 1584, label: 'Solmara Beach' },
    },
  };

  world.isRoad = function (x, y) {
    for (const vx of ROADS_V) if (Math.abs(x - vx) <= ROAD_W / 2 + 6) return true;
    for (const hy of ROADS_H) if (Math.abs(y - hy) <= ROAD_W / 2 + 6) return true;
    return false;
  };
  world.onSand = (x) => x >= BEACH_X && x < SEA_X;
  world.inSea = (x) => x >= SEA_X;
  world.nearestNode = function (x, y) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = (nodes[i].x - x) ** 2 + (nodes[i].y - y) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };
  // Push a circle out of every building it overlaps; returns corrected pos.
  world.resolveBuildings = function (x, y, r) {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const b of buildings) {
        if (x < b.x - r || x > b.x + b.w + r || y < b.y - r || y > b.y + b.h + r) continue;
        const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h);
        const dx = x - cx, dy = y - cy, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r; y = cy + (dy / d) * r;
        } else {
          const l = x - b.x, rr = b.x + b.w - x, t = y - b.y, bo = b.y + b.h - y;
          const m = Math.min(l, rr, t, bo);
          if (m === l) x = b.x - r; else if (m === rr) x = b.x + b.w + r;
          else if (m === t) y = b.y - r; else y = b.y + b.h + r;
        }
        moved = true;
      }
      if (!moved) break;
    }
    return { x, y };
  };
  return world;
}
