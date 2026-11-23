// police.js — Solmara PD and the wanted system. Heat rises when the player
// steals, hits or shoots; it cools when the player lays low. Police cars
// spawn on the roads around the player and hunt them down; at high heat they
// set roadblocks, and on foot a caught player is busted.
import { clamp, dist, angleDiff } from './util.js';
import { makeCar, updateCar } from './vehicles.js';

export function heatForWanted(wanted) {
  return ['Clean', 'Noticed', 'Wanted', 'Hunted', 'Manhunt', 'Lockdown'][wanted] || 'Clean';
}

// wanted: 0..5. addHeat bumps it (capped); decay cools it over quiet time.
export function addHeat(state, n) {
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.heatTimer = 0;
}

export function updateWanted(state, dt, committingCrime) {
  if (committingCrime) { state.heatTimer = 0; return; }
  state.heatTimer += dt;
  // 25 quiet seconds per star, slower the hotter you are.
  const need = 25 + state.wanted * 8;
  if (state.heatTimer > need && state.wanted > 0) {
    state.wanted -= 1;
    state.heatTimer = 0;
  }
}

export function wantedTargetCount(wanted) {
  return [0, 1, 2, 3, 4, 4][wanted] || 0;
}

// Spawn a police car on a road node near the player, behind the camera edge.
export function spawnPolice(world, rng, player) {
  const node = world.nearestNode(
    player.x + (rng.chance(0.5) ? -1 : 1) * rng.range(500, 800),
    player.y + (rng.chance(0.5) ? -1 : 1) * rng.range(400, 700),
  );
  const n = world.nodes[node];
  const car = makeCar(6, n.x, n.y, 0, 'police');
  car.siren = true;
  return car;
}

// Pursuit steering: chase the player, ram to stop them.
export function updatePolice(car, dt, world, player, others) {
  const want = Math.atan2(player.y - car.y, player.x - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.6, -1, 1);
  const d = dist(car.x, car.y, player.x, player.y);
  const throttle = d > 60 ? 1 : 0.55;
  updateCar(car, { throttle, steer, brake: 0 }, dt, world, others);
  // A police car that touches an on-foot player holds them: busted timer.
  if (player.mode === 'foot' && d < 34) return 'touching';
  return null;
}

// Roadblock: two police cars parked across the road ahead of the player.
export function makeRoadblock(world, rng, player) {
  const node = world.nearestNode(player.x + Math.cos(player.angle || 0) * 420, player.y + Math.sin(player.angle || 0) * 420);
  const n = world.nodes[node];
  const a = rng.range(0, Math.PI);
  const c1 = makeCar(6, n.x + Math.cos(a) * 30, n.y + Math.sin(a) * 30, a + Math.PI / 2, 'police');
  const c2 = makeCar(6, n.x - Math.cos(a) * 30, n.y - Math.sin(a) * 30, a + Math.PI / 2, 'police');
  c1.speed = 0; c2.speed = 0; c1.block = true; c2.block = true;
  return [c1, c2];
}
