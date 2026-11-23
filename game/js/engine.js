// Santa Brisa Rush — engine: game state, the main loop, the camera, saving,
// the demo autopilot and the staged scenes used for screenshots.
// The simulation runs on a fixed 1/60 step from a single seed, so a demo run
// with the same seed always ends in the same place.

import { makeRng, clamp, dist, angleTo, angleDiff, wrapAngle } from './rng.js';
import { buildCity, collidesBuilding } from './city.js';
import { spawnWalkers, updateWalkers } from './walkers.js';
import { spawnTraffic, spawnParked, updateTraffic, drivePlayerCar, nearestEnterableCar, stealCar } from './traffic.js';
import { updateHeat } from './heat.js';
import { punch, shoot, updateBullets } from './fists.js';
import { startContract, updateContracts, startTaxiJob, updateTaxi, CONTRACTS } from './contracts.js';
import { makeSynth } from './synth.js';
import { makeInput, bindInput, consumePress } from './keys.js';
import { drawWorld, drawEntities, drawObjectiveMarker } from './draw.js';
import { drawHud, drawMinimap, drawTitle, drawCenterCard, drawTouchButtons } from './display.js';

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const SAVE_KEY = 'santa-brisa-rush-save-v1';
const SEED = 20261123;

export function createGame(canvas, params) {
  const rng = makeRng(SEED);
  const world = buildCity(SEED + 7);
  const G = {
    canvas,
    ctx: canvas.getContext('2d'),
    rng,
    world,
    tick: 0,
    mode: 'title',
    modeTimer: 0,
    seed: SEED,
    player: {
      x: 1520, y: 2330, angle: -Math.PI / 2, health: 100, cash: 50,
      wanted: 0, onFoot: true, car: null, ammo: 24,
      punchCooldown: 0, punchAnim: 0, shootCooldown: 0, bustTimer: 0,
    },
    walkers: spawnWalkers(world, makeRng(SEED + 11), 42),
    cars: [],
    cops: [],
    roadblocks: [],
    bullets: [],
    particles: [],
    mission: null,
    missionDoneText: '',
    taxi: { active: false, phase: null, pickup: null, dest: null, fare: 0, timer: 0 },
    cam: { x: 900, y: 1900 },
    input: makeInput(),
    audio: makeSynth(),
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, missionsDone: 0, faresDone: 0 },
    heatTimer: 0,
    saveExists: false,
    demo: params.get('demo') === '1',
    shot: params.get('shot') || null,
    reportWritten: false,
    touchButtons: [],
  };
  G.cars.push(...spawnTraffic(world, makeRng(SEED + 23), 16));
  G.cars.push(...spawnParked(world, makeRng(SEED + 31), 12));
  try {
    G.saveExists = !!window.localStorage.getItem(SAVE_KEY);
  } catch (e) { /* no storage */ }
  return G;
}

export function saveGame(G) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: G.player.cash,
      missionsDone: G.stats.missionsDone,
      faresDone: G.stats.faresDone,
      x: G.player.x,
      y: G.player.y,
    }));
    G.saveExists = true;
  } catch (e) { /* no storage */ }
}

export function loadSave(G) {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.player.cash = s.cash || 50;
    G.player.x = s.x || 1520;
    G.player.y = s.y || 2330;
    G.stats.missionsDone = s.missionsDone || 0;
    G.stats.faresDone = s.faresDone || 0;
    return true;
  } catch (e) {
    return false;
  }
}

function enterCar(G) {
  const p = G.player;
  const car = nearestEnterableCar(G);
  if (!car) return;
  if (car.parked) stealCar(G, car);
  else {
    car.parked = false;
    car.traffic = false;
    p.car = car;
    p.onFoot = false;
    G.audio.door();
  }
}

function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.parked = true;
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  p.x = car.x - Math.cos(car.angle) * 40;
  p.y = car.y - Math.sin(car.angle) * 40;
  p.angle = car.angle;
  G.audio.door();
}

function moveOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const speed = 175;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const nx = p.x + (mx / len) * speed * dt;
    const ny = p.y + (my / len) * speed * dt;
    if (!collidesBuilding(G.world, nx, p.y, 12)) p.x = clamp(nx, 30, G.world.w - 30);
    if (!collidesBuilding(G.world, p.x, ny, 12)) p.y = clamp(ny, 30, G.world.h - 24);
    p.angle = Math.atan2(my, mx);
  }
  const rect = G.canvas.getBoundingClientRect();
  const wx = G.cam.x + input.mouseX * (G.canvas.width / rect.width) * (VIEW_W / G.canvas.width);
  const wy = G.cam.y + input.mouseY * (G.canvas.height / rect.height) * (VIEW_H / G.canvas.height);
  if (dist(G.canvas.width / 2, G.canvas.height / 2, input.mouseX, input.mouseY) > 60) {
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.punchAnim > 0) p.punchAnim -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
}

const DEMO_WAYPOINTS = [
  { x: 2120, y: 820 },
  { x: 2120, y: 1320 },
  { x: 1520, y: 1320 },
  { x: 1520, y: 820 },
];

function driveWaypoints(G) {
  const p = G.player;
  if (!p.car) return;
  const wp = DEMO_WAYPOINTS[G.demoWp || 0];
  const d = dist(p.x, p.y, wp.x, wp.y);
  if (d < 90) G.demoWp = ((G.demoWp || 0) + 1) % DEMO_WAYPOINTS.length;
  const target = angleTo(p.x, p.y, wp.x, wp.y);
  const diff = angleDiff(p.car.angle, target);
  const sharp = Math.abs(diff) > 0.55;
  G.input.up = !sharp && Math.abs(diff) < 1.1 && !(d < 160 && p.car.speed > 220);
  G.input.down = sharp || (d < 160 && p.car.speed > 220);
  G.input.left = diff < -0.12;
  G.input.right = diff > 0.12;
  G.input.handbrake = false;
}

function runDemo(G, dt) {
  driveWaypoints(G);
  const p = G.player;
  if (G.tick === 600 && !G.reportWritten) {
    G.reportWritten = true;
    const el = document.getElementById('demo-report');
    if (el) {
      el.textContent = JSON.stringify({
        tick: G.tick,
        x: Math.round(p.x),
        y: Math.round(p.y),
        angle: +p.car.angle.toFixed(4),
        speed: Math.round(p.car.speed),
        cash: p.cash,
        wanted: p.wanted,
        missionsDone: G.stats.missionsDone,
        carsStolen: G.stats.carsStolen,
      });
    }
  }
}

function stageShot(G) {
  const shot = G.shot;
  const p = G.player;
  if (shot === 'menu') {
    G.mode = 'title';
    return;
  }
  G.mode = 'play';
  G.shotDrive = true;
  G.demoWp = 0;
  if (shot === 'cover') {
    const car = G.cars.find((c) => c.parked && c.model === 'sedan');
    if (car) {
      car.x = 1520;
      car.y = 820;
      car.angle = 0;
      car.color = '#e84c4c';
      p.car = car;
      p.onFoot = false;
      p.x = car.x;
      p.y = car.y;
    }
    startContract(G, 0);
  } else if (shot === 'chase') {
    G.demoWp = 2;
    const car = G.cars.find((c) => c.parked && c.model === 'sport');
    const sport = car || G.cars.find((c) => c.parked);
    if (sport) {
      sport.x = 2120;
      sport.y = 1320;
      sport.angle = Math.PI;
      sport.color = '#e84c4c';
      sport.model = 'sport';
      p.car = sport;
      p.onFoot = false;
      p.x = sport.x;
      p.y = sport.y;
      p.angle = Math.PI;
    }
    p.wanted = 3;
    G.heatTimer = 0;
    startContract(G, 3);
  } else if (shot === 'taxi') {
    const taxi = G.cars.find((c) => c.parked && c.model === 'taxi') || G.cars.find((c) => c.parked);
    if (taxi) {
      taxi.x = 920;
      taxi.y = 820;
      taxi.angle = Math.PI / 2;
      taxi.model = 'taxi';
      taxi.color = '#ffd23d';
      p.car = taxi;
      p.onFoot = false;
      p.x = taxi.x;
      p.y = taxi.y;
    }
    G.taxi = {
      active: true, phase: 'toDrop',
      pickup: { x: 920, y: 820 },
      dest: { x: 3050, y: 1150, name: 'the Marina' },
      fare: 86, timer: 0,
    };
  }
}

function stepPlay(G, dt) {
  const p = G.player;
  if (G.demo) runDemo(G, dt);
  else if (G.shotDrive) driveWaypoints(G);
  if (consumePress(G, 'KeyE')) {
    if (p.onFoot) enterCar(G);
    else exitCar(G);
  }
  if (consumePress(G, 'KeyF')) punch(G);
  if (consumePress(G, 'KeyN')) startTaxiJob(G);
  if (consumePress(G, 'KeyM')) G.audio.toggleMute();
  if (G.input.mouseDown) {
    const rect = G.canvas.getBoundingClientRect();
    const wx = G.cam.x + (G.input.mouseX / rect.width) * VIEW_W;
    const wy = G.cam.y + (G.input.mouseY / rect.height) * VIEW_H;
    shoot(G, wx, wy);
  }
  if (p.onFoot) moveOnFoot(G, dt);
  else drivePlayerCar(G, dt);
  updateTraffic(G, dt);
  updateWalkers(G, dt);
  updateHeat(G, dt);
  updateBullets(G, dt);
  updateContracts(G, dt);
  updateTaxi(G, dt);
  if (p.health <= 0) G.mode = 'wasted';
  const targetX = clamp(p.x - VIEW_W / 2, 0, G.world.w - VIEW_W);
  const targetY = clamp(p.y - VIEW_H / 2, 0, G.world.h - VIEW_H);
  G.cam.x += (targetX - G.cam.x) * Math.min(1, 6 * dt);
  G.cam.y += (targetY - G.cam.y) * Math.min(1, 6 * dt);
  if (G.tick % 600 === 0) saveGame(G);
}

function render(G) {
  const ctx = G.ctx;
  ctx.save();
  if (G.mode === 'title') {
    drawTitle(ctx, G);
    ctx.restore();
    return;
  }
  ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));
  drawWorld(ctx, G);
  drawObjectiveMarker(ctx, G);
  drawEntities(ctx, G);
  ctx.restore();
  drawHud(ctx, G);
  drawMinimap(ctx, G);
  drawTouchButtons(ctx, G);
  if (G.mode === 'paused') {
    drawCenterCard(ctx, 'PAUSED', ['P resume · M mute', 'Progress autosaves every 10 seconds'], '#ffd23d');
  } else if (G.mode === 'busted') {
    drawCenterCard(ctx, 'BUSTED', ['Captain Ruiz finally caught up with you.', 'Press ENTER — the department keeps $100 of your cash.'], '#1c5fd6');
  } else if (G.mode === 'wasted') {
    drawCenterCard(ctx, 'WASTED', ['Santa Brisa is a rough town, Nico.', 'Press ENTER to get back on your feet.'], '#e84c4c');
  } else if (G.mode === 'contractDone') {
    drawCenterCard(ctx, 'CONTRACT DONE', [G.missionDoneText, 'The next contract is already waiting.'], '#37b24d');
  } else if (G.mode === 'finale') {
    drawCenterCard(ctx, 'SANTA BRISA IS YOURS', ['All five contracts complete.', 'Nico Reyes owns the city now. Press ENTER to keep playing.'], '#ffd23d');
  }
}

export function startGame(canvas) {
  const params = new URLSearchParams(window.location.search);
  const G = createGame(canvas, params);
  bindInput(G, canvas);
  if (G.demo) {
    const car = G.cars.find((c) => c.parked && c.model === 'sedan');
    if (car) {
      car.x = 1520;
      car.y = 820;
      car.angle = 0;
      p_carSetup(G, car);
    }
    G.mode = 'play';
    G.demoWp = 0;
  } else if (G.shot) {
    stageShot(G);
  }
  // The loop runs on a 16 ms timer rather than requestAnimationFrame: a timer
  // advances under virtual time in headless runs, while rAF barely fires
  // there, and in a live browser it still ticks at about 60 frames a second.
  let last = Date.now();
  let acc = 0;
  function frame() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= 1 / 60 && steps < 10) {
      acc -= 1 / 60;
      steps += 1;
      G.tick += 1;
      if (G.mode === 'title') {
        if (consumePress(G, 'Enter')) {
          G.mode = 'play';
          startContract(G, G.stats.missionsDone % CONTRACTS.length);
          saveGame(G);
        } else if (consumePress(G, 'KeyC') && G.saveExists) {
          loadSave(G);
          G.mode = 'play';
          startContract(G, G.stats.missionsDone % CONTRACTS.length);
        }
      } else if (G.mode === 'play') {
        if (consumePress(G, 'KeyP')) G.mode = 'paused';
        else stepPlay(G, 1 / 60);
      } else if (G.mode === 'paused') {
        if (consumePress(G, 'KeyP') || consumePress(G, 'Enter')) G.mode = 'play';
      } else if (G.mode === 'busted' || G.mode === 'wasted') {
        if (consumePress(G, 'Enter')) {
          G.player.health = 100;
          G.player.wanted = 0;
          G.player.cash = Math.max(0, G.player.cash - 100);
          G.player.x = 1520;
          G.player.y = 2330;
          G.player.bustTimer = 0;
          if (G.player.car) {
            G.player.car.parked = true;
            G.player.car = null;
            G.player.onFoot = true;
          }
          G.mode = 'play';
        }
      } else if (G.mode === 'contractDone' || G.mode === 'finale') {
        G.modeTimer -= 1 / 60;
        if (G.modeTimer <= 0 || consumePress(G, 'Enter')) {
          G.mode = 'play';
          if (G.stats.missionsDone < CONTRACTS.length) {
            startContract(G, G.stats.missionsDone);
          }
        }
      }
    }
    render(G);
    setTimeout(frame, 16);
  }
  setTimeout(frame, 16);
  return G;
}

function p_carSetup(G, car) {
  car.parked = false;
  car.traffic = false;
  G.player.car = car;
  G.player.onFoot = false;
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;
  G.stats.carsStolen += 1;
}
