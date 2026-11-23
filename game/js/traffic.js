// Santa Brisa Rush — cars, traffic and carjacking.
// Traffic cars cruise the avenue and street grid, slow down for the car ahead,
// and wrap around the city edge. Parked cars wait to be stolen: walk up and
// press E and the car is yours — if anyone sees it, the heat goes up.

import { makeRng, clamp, dist, angleDiff, wrapAngle } from './rng.js';
import { nearestRoadPoint, collidesBuilding } from './city.js';

const PAINT = ['#e84c4c', '#4c8fe8', '#e8c94c', '#7ae84c', '#e84cd8', '#f2f2f2', '#3d3d3d', '#ff9a3d', '#4ce8d0'];
const MODELS = ['sedan', 'hatch', 'pickup', 'sport', 'taxi', 'van'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y,
    angle,
    speed: opts.speed || 0,
    color: opts.color || '#e84c4c',
    model: opts.model || 'sedan',
    traffic: !!opts.traffic,
    police: !!opts.police,
    roadblock: !!opts.roadblock,
    parked: !!opts.parked,
    cruise: opts.cruise || 150,
    route: opts.route || null,
    stuck: 0,
  };
}

export function spawnTraffic(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const spot = nearestRoadPoint(rng.range(120, world.w - 120), rng.range(120, world.beachTop - 120));
    const vertical = spot.vertical;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    cars.push(makeCar(
      vertical ? spot.x + (rng.chance(0.5) ? 20 : -20) : spot.x,
      vertical ? spot.y : spot.y + (rng.chance(0.5) ? 20 : -20),
      angle,
      {
        traffic: true,
        color: rng.pick(PAINT),
        model: rng.pick(MODELS),
        cruise: rng.range(120, 190),
        speed: rng.range(100, 170),
        route: { vertical, dir: angle },
      },
    ));
  }
  return cars;
}

export function spawnParked(world, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const spot = nearestRoadPoint(rng.range(120, world.w - 120), rng.range(120, world.beachTop - 120));
    const vertical = spot.vertical;
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    cars.push(makeCar(
      vertical ? spot.x + (rng.chance(0.5) ? 66 : -66) : spot.x + rng.range(-200, 200),
      vertical ? spot.y + rng.range(-200, 200) : spot.y + (rng.chance(0.5) ? 66 : -66),
      angle,
      { parked: true, color: rng.pick(PAINT), model: rng.pick(MODELS) },
    ));
  }
  return cars;
}

function carAhead(G, car, look) {
  let best = Infinity;
  for (const other of G.cars) {
    if (other === car || other.parked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < look && side < 26 && forward < best) best = forward;
  }
  return best;
}

export function updateTraffic(G, dt) {
  const { world } = G;
  for (const car of G.cars) {
    if (!car.traffic) continue;
    const ahead = carAhead(G, car, 90);
    const target = ahead < 70 ? 0 : car.cruise;
    car.speed += clamp(target - car.speed, -260 * dt, 140 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (collidesBuilding(world, nx, ny, 20)) {
      car.angle = wrapAngle(car.angle + Math.PI / 2);
      car.speed *= 0.4;
      continue;
    }
    car.x = nx;
    car.y = ny;
    if (car.x < 60 || car.x > world.w - 60 || car.y < 60 || car.y > world.beachTop - 40) {
      const spot = nearestRoadPoint(G.rng.range(120, world.w - 120), G.rng.range(120, world.beachTop - 120));
      car.x = spot.x;
      car.y = spot.y;
      car.angle = spot.vertical ? Math.PI / 2 : 0;
      car.speed = car.cruise;
    }
    const spot = nearestRoadPoint(car.x, car.y);
    const lane = spot.vertical ? spot.x : spot.y;
    const pos = spot.vertical ? car.x : car.y;
    const pull = clamp(lane - pos, -1, 1) * 30 * dt;
    if (spot.vertical) car.x += pull;
    else car.y += pull;
  }
}

export function drivePlayerCar(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = G.input;
  if (!car) return;
  const forward = (input.up ? 1 : 0) - (input.down ? 0.55 : 0);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const accel = forward * (car.speed < 0 ? 520 : 340);
  car.speed += accel * dt;
  if (input.handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed *= Math.max(0, 1 - 0.55 * dt);
  car.speed = clamp(car.speed, -140, 430);
  if (Math.abs(car.speed) > 12) {
    car.angle = wrapAngle(car.angle + steer * 2.1 * dt * clamp(car.speed / 160, -1, 1));
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collidesBuilding(G.world, nx, ny, 20);
  if (hit) {
    car.speed *= -0.25;
    G.audio.bump();
    G.particles.push({
      x: nx, y: ny, vx: 0, vy: 0, life: 0.4, color: '#ffd23d', size: 5,
    });
  } else {
    car.x = clamp(nx, 40, G.world.w - 40);
    car.y = clamp(ny, 40, G.world.h - 30);
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (Math.abs(car.speed) > 30) G.audio.engine(Math.abs(car.speed) / 430);
}

export function nearestEnterableCar(G, maxD = 70) {
  let best = null;
  let bestD = maxD;
  for (const car of G.cars) {
    if (car.police || car.roadblock) continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function stealCar(G, car) {
  car.parked = false;
  car.traffic = false;
  G.player.car = car;
  G.player.onFoot = false;
  G.stats.carsStolen += 1;
  const seen = G.cops.some((c) => dist(c.x, c.y, car.x, car.y) < 520);
  if (seen || G.player.wanted > 0) {
    G.player.wanted = Math.min(5, Math.max(1, G.player.wanted));
    G.heatTimer = 0;
  } else if (G.rng.chance(0.35)) {
    G.player.wanted = 1;
    G.heatTimer = 0;
  }
  G.audio.door();
}
