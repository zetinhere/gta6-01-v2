// vehicles.js — car models, arcade driving physics and the traffic that
// fills Solmara's streets. Every car is one object; the player, traffic and
// police all drive the same physics.
import { RNG, clamp, angleDiff, angleLerp, dist } from './util.js';

export const CAR_MODELS = [
  { name: 'Sundowner', len: 46, wid: 22, accel: 340, top: 520, grip: 2.6, colors: ['#ff5d5d', '#ffb347', '#4fc3f7', '#e0e0e0'] },
  { name: 'Taxi Cab',  len: 46, wid: 22, accel: 300, top: 460, grip: 2.4, colors: ['#ffd21f'] },
  { name: 'Pickup',    len: 52, wid: 24, accel: 280, top: 430, grip: 2.2, colors: ['#7fb069', '#c96f4a', '#5b8dd9'] },
  { name: 'Coupe',     len: 44, wid: 21, accel: 420, top: 600, grip: 3.0, colors: ['#ff2e88', '#00e5ff', '#ffd21f', '#9d4edd'] },
  { name: 'Van',       len: 56, wid: 24, accel: 240, top: 380, grip: 2.0, colors: ['#e8e8e8', '#8d99ae'] },
  { name: 'Bike',      len: 34, wid: 12, accel: 480, top: 560, grip: 3.4, colors: ['#ff2e88', '#222831'] },
  { name: 'Police',    len: 48, wid: 23, accel: 400, top: 580, grip: 3.0, colors: ['#1d3557'] },
];

export function makeCar(modelIdx, x, y, angle, driver) {
  const m = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    model: m, modelIdx, x, y, angle, speed: 0,
    color: m.colors[Math.floor(Math.random() * m.colors.length)],
    driver, // 'player' | 'traffic' | 'police'
    health: 100, skidding: false, node: -1, nodeTarget: -1,
    stuck: 0, siren: driver === 'police',
  };
}

// One physics step for any car. ctl: {throttle 0..1, steer -1..1, brake 0..1}.
export function updateCar(car, ctl, dt, world, others) {
  const m = car.model;
  const onRoad = world.isRoad(car.x, car.y) || world.onSand(car.x);
  const grip = m.grip * (onRoad ? 1 : 0.55);
  const top = m.top * (onRoad ? 1 : 0.6);
  const fwd = car.speed >= 0 ? 1 : -1;
  // Steering bites harder at speed, and flips when reversing.
  car.angle += ctl.steer * grip * clamp(Math.abs(car.speed) / 160, 0, 1) * fwd * dt;
  if (ctl.throttle > 0) car.speed += m.accel * ctl.throttle * dt * (car.speed < top ? 1 : 0.25);
  if (ctl.brake > 0) {
    if (car.speed > 8) car.speed -= 620 * ctl.brake * dt;
    else car.speed -= m.accel * 0.55 * ctl.brake * dt; // reverse
  }
  car.speed -= car.speed * 0.55 * dt; // rolling drag
  if (Math.abs(car.speed) < 4 && ctl.throttle === 0 && ctl.brake === 0) car.speed = 0;
  car.speed = clamp(car.speed, -180, top + 60);
  car.skidding = Math.abs(ctl.steer) > 0.7 && Math.abs(car.speed) > 260;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  // The sea is a wall; the beach is slow sand.
  if (car.x > 2940) { car.x = 2940; car.speed *= 0.4; }
  car.x = clamp(car.x, 24, 3180);
  car.y = clamp(car.y, 24, 2376);
  // Buildings: resolve the nose and tail as circles.
  const fx = car.x + Math.cos(car.angle) * m.len * 0.32;
  const fy = car.y + Math.sin(car.angle) * m.len * 0.32;
  const rx = car.x - Math.cos(car.angle) * m.len * 0.32;
  const ry = car.y - Math.sin(car.angle) * m.len * 0.32;
  const p1 = world.resolveBuildings(fx, fy, 12);
  const p2 = world.resolveBuildings(rx, ry, 12);
  car.x = (p1.x + p2.x) / 2; car.y = (p1.y + p2.y) / 2;
  // Car-to-car bumps: push apart and trade a little speed.
  for (const o of others) {
    if (o === car) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    const min = 26;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = (car.x - o.x) / d, uy = (car.y - o.y) / d;
      car.x += ux * push; car.y += uy * push;
      o.x -= ux * push; o.y -= uy * push;
      const s = car.speed; car.speed = o.speed * 0.6; o.speed = s * 0.6;
      car.health -= 2; o.health -= 2;
    }
  }
  return car;
}

// Traffic: each car follows the road graph toward a node, then picks the next.
export function makeTrafficCar(world, rng, nearX, nearY) {
  const node = world.nearestNode(nearX + rng.range(-500, 500), nearY + rng.range(-500, 500));
  const n = world.nodes[node];
  const modelIdx = rng.int(0, 5);
  const car = makeCar(modelIdx, n.x + rng.range(-20, 20), n.y + rng.range(-20, 20), rng.range(0, Math.PI * 2), 'traffic');
  car.node = node;
  car.nodeTarget = world.edges[node][Math.floor(rng.next() * world.edges[node].length)];
  car.speed = rng.range(90, 150);
  return car;
}

export function updateTraffic(car, dt, world, rng, player, others) {
  // Off-road recovery: a car shoved off the road steers back to the
  // nearest junction instead of cutting across the blocks.
  let target = world.nodes[car.nodeTarget];
  if (!target) return;
  if (!world.isRoad(car.x, car.y)) {
    target = world.nodes[world.nearestNode(car.x, car.y)];
    car.nodeTarget = world.nearestNode(car.x, car.y);
  }
  const td = dist(car.x, car.y, target.x, target.y);
  const want = Math.atan2(target.y - car.y, target.x - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.2, -1, 1);
  // Slow down for the turn at the next junction — tight corners, no
  // driving over the kerb.
  let throttle = td < 70 ? 0.28 : 0.65;
  for (const o of others) {
    if (o === car) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < 100 && Math.abs(angleDiff(car.angle, Math.atan2(o.y - car.y, o.x - car.x))) < 0.9) { throttle = 0; break; }
    // Yield at a junction when another car is already in it.
    if (td < 90 && d < 120 && dist(o.x, o.y, target.x, target.y) < 110) { throttle = 0; break; }
    // A hard overlap: bleed both cars' speed so they separate cleanly.
    if (d < 26) { car.speed *= 0.55; o.speed *= 0.55; }
  }
  // Don't run the player down: brake if the player is right ahead on foot.
  if (player && player.mode === 'foot') {
    const d = dist(car.x, car.y, player.x, player.y);
    if (d < 110 && Math.abs(angleDiff(car.angle, Math.atan2(player.y - car.y, player.x - car.x))) < 0.9) throttle = 0;
  }
  updateCar(car, { throttle, steer, brake: throttle === 0 ? 0.8 : 0 }, dt, world, others);
  if (dist(car.x, car.y, target.x, target.y) < 26) {
    car.node = car.nodeTarget;
    const next = world.edges[car.node].filter((e) => e !== car.node);
    car.nodeTarget = next.length ? next[Math.floor(rng.next() * next.length)] : car.node;
  }
  if (car.health <= 0) { car.speed = 0; }
}
