// Santa Brisa Rush — the heat: wanted stars, Santa Brisa PD pursuit cars and
// roadblocks. Crimes raise the heat; laying low lets it cool. At three stars
// and up the department blocks the roads ahead of you.

import { clamp, dist, angleTo, angleDiff, wrapAngle } from './rng.js';
import { makeCar } from './traffic.js';
import { nearestRoadPoint } from './city.js';

const STAR_NAMES = ['Clean', 'One Star', 'Two Stars', 'Three Stars', 'Four Stars', 'Five Stars'];

export function starName(stars) {
  return STAR_NAMES[clamp(stars, 0, 5)];
}

export function raiseHeat(G, amount) {
  G.player.wanted = clamp(G.player.wanted + amount, 0, 5);
  G.heatTimer = 0;
  if (G.player.wanted >= 2) G.audio.siren();
}

export function spawnCop(G, x, y) {
  const cop = makeCar(x, y, angleTo(x, y, G.player.x, G.player.y), {
    police: true,
    color: '#1c1c1c',
    model: 'sedan',
    cruise: 330,
    speed: 200,
  });
  G.cars.push(cop);
  G.cops.push(cop);
  return cop;
}

export function updateHeat(G, dt) {
  const p = G.player;
  G.heatTimer += dt;
  const want = Math.min(4, Math.max(1, p.wanted));
  while (G.cops.length < want && G.cops.length < 5) {
    const edge = G.rng.pick([
      { x: G.cam.x + 700, y: G.cam.y + 300 },
      { x: G.cam.x - 100, y: G.cam.y + 300 },
      { x: G.cam.x + 300, y: G.cam.y - 100 },
      { x: G.cam.x + 300, y: G.cam.y + 700 },
    ]);
    const spot = nearestRoadPoint(edge.x, edge.y);
    spawnCop(G, spot.x, spot.y);
  }
  while (G.cops.length > want) {
    const cop = G.cops.pop();
    const i = G.cars.indexOf(cop);
    if (i >= 0) G.cars.splice(i, 1);
  }

  if (p.wanted > 0 && G.heatTimer > 26) {
    p.wanted -= 1;
    G.heatTimer = 0;
    if (p.wanted === 0) G.audio.allClear();
  }

  if (p.wanted >= 3 && G.roadblocks.length === 0) {
    const ahead = {
      x: p.x + Math.cos(p.angle) * 420,
      y: p.y + Math.sin(p.angle) * 420,
    };
    const spot = nearestRoadPoint(ahead.x, ahead.y);
    const vertical = spot.vertical;
    for (let k = -1; k <= 1; k++) {
      const block = makeCar(
        vertical ? spot.x : spot.x + k * 56,
        vertical ? spot.y + k * 56 : spot.y,
        vertical ? 0 : Math.PI / 2,
        { roadblock: true, color: '#1c1c1c', model: 'sedan' },
      );
      G.cars.push(block);
      G.roadblocks.push(block);
    }
    G.audio.siren();
  }
  if (p.wanted < 3 && G.roadblocks.length > 0) {
    for (const b of G.roadblocks) {
      const i = G.cars.indexOf(b);
      if (i >= 0) G.cars.splice(i, 1);
    }
    G.roadblocks = [];
  }

  for (const cop of G.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    const target = angleTo(cop.x, cop.y, p.x, p.y);
    const diff = angleDiff(cop.angle, target);
    cop.angle = wrapAngle(cop.angle + clamp(diff, -2.4 * dt, 2.4 * dt));
    const wantSpeed = d > 260 ? 360 : 300;
    cop.speed += clamp(wantSpeed - cop.speed, -300 * dt, 240 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    cop.x = clamp(nx, 40, G.world.w - 40);
    cop.y = clamp(ny, 40, G.world.h - 30);
    if (d < 46) {
      if (p.onFoot) {
        p.bustTimer += dt;
        if (p.bustTimer > 1.4) G.mode = 'busted';
      } else {
        p.health -= 14 * dt;
        cop.speed *= 0.92;
        if (p.health <= 0) G.mode = 'wasted';
      }
    }
  }
  if (G.cops.length === 0) p.bustTimer = 0;
}
