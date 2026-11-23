// main.js — Solmara Heat: boot, game loop, screens, player controls, the
// systems talking to each other, and the ?scene= staging for screenshots.
import { RNG, clamp, dist, angleDiff } from './util.js';
import { genWorld, WORLD_W, WORLD_H } from './world.js';
import { makeCar, updateCar, makeTrafficCar, updateTraffic, CAR_MODELS } from './vehicles.js';
import { makePed, updatePeds, hitPed } from './peds.js';
import { addHeat, updateWanted, wantedTargetCount, spawnPolice, updatePolice, makeRoadblock } from './police.js';
import { makeBullets, shoot, punch, updateBullets, makePickup, updatePickups, applyPickup } from './combat.js';
import { MissionRunner, CAMPAIGN, spawnFare } from './missions.js';
import { drawWorld, makeCamera, updateCamera } from './render.js';
import { drawHUD, drawTitle, drawBriefing, drawPause, drawEndCard, drawComplete } from './hud.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { saveExists, loadSave, writeSave } from './save.js';

const params = new URLSearchParams(location.search);
const SCENE = params.get('scene');
const DEMO = params.get('demo') === '1';
const SEED = 20261123;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const state = {
  world: null, rng: new RNG(SEED),
  player: null, traffic: [], policeCars: [], parked: [], peds: [],
  bullets: makeBullets(), pickups: [], particles: [], skids: [],
  missions: new MissionRunner(),
  fare: null, fareTimer: 8,
  message: '', messageT: 0, dialogue: null, dialogueT: 0,
  screen: 'title', menuSel: 0, showHelp: false,
  time: 0, camera: makeCamera(),
  input: new Input(canvas), audio: new AudioSys(),
  wanted: 0, heatTimer: 0, bustedT: 0, hurtT: 0,
  waypoint: null, nearCar: null, crimeThisFrame: false,
  stats: { earned: 0, time: 0 },
  demo: DEMO, scene: SCENE, saveExists: saveExists(),
  roadblockTimer: 0, policeTimer: 0, autosaveT: 0,
  punchCd: 0, shootCd: 0,
};

function say(msg, secs) { state.message = msg; state.messageT = secs || 3; }

function spawnPlayerCar(modelIdx, x, y, angle) {
  const car = makeCar(modelIdx, x, y, angle, 'player');
  state.player.car = car;
  state.player.mode = 'car';
  state.player.x = x; state.player.y = y; state.player.angle = angle;
  return car;
}

function resetPlayerTo(placeKey) {
  const p = state.world.places[placeKey] || state.world.places.hotel;
  state.player.x = p.x; state.player.y = p.y;
  state.player.angle = -Math.PI / 2;
  state.player.mode = 'foot';
  state.player.car = null;
  state.player.health = 100;
  state.wanted = 0; state.heatTimer = 0; state.bustedT = 0;
  state.policeCars = [];
  state.camera.x = p.x; state.camera.y = p.y;
}

function allCars() {
  const list = [...state.traffic, ...state.policeCars, ...state.parked];
  if (state.player.car) list.push(state.player.car);
  return list;
}

function nearestCarTo(x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of [...state.traffic, ...state.parked]) {
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car, stolen) {
  state.player.car = car;
  state.player.mode = 'car';
  state.player.angle = car.angle;
  car.driver = 'player';
  state.traffic = state.traffic.filter((c) => c !== car);
  state.parked = state.parked.filter((c) => c !== car);
  if (stolen) {
    addHeat(state, 1);
    state.crimeThisFrame = true;
    say('Car stolen! The cops noticed.');
    state.audio.sfx('siren');
  } else {
    state.audio.sfx('click');
  }
}

function exitCar() {
  const car = state.player.car;
  if (!car) return;
  car.driver = 'parked';
  state.parked.push(car);
  state.player.mode = 'foot';
  state.player.x = car.x - Math.cos(car.angle) * 0 + 26;
  state.player.y = car.y + 26;
  state.player.car = null;
  const fixed = state.world.resolveBuildings(state.player.x, state.player.y, 10);
  state.player.x = fixed.x; state.player.y = fixed.y;
}

function startMission(i) {
  state.missions.startMission(i);
  state.screen = 'briefing';
  setDialogue();
}

function setDialogue() {
  const m = state.missions.mission;
  if (!m) { state.dialogue = null; return; }
  const line = m.brief[state.missions.briefLine];
  state.dialogue = { speaker: line[0], text: line[1], shown: '' };
  state.dialogueT = 0;
}

function retryMission() {
  state.player.cash = Math.max(0, state.player.cash - 100);
  resetPlayerTo('hotel');
  startMission(state.missions.index);
}

function init() {
  state.world = genWorld(SEED);
  state.player = {
    x: 1344, y: 720, angle: -Math.PI / 2, mode: 'foot', car: null,
    health: 100, cash: 0, ammo: 48, weapon: 'pistol',
  };
  // Traffic and people near the hotel.
  for (let i = 0; i < 10; i++) state.traffic.push(makeTrafficCar(state.world, state.rng, 1344, 720));
  for (let i = 0; i < 16; i++) state.peds.push(makePed(state.world, state.rng, 1344, 720));
  state.pickups.push(makePickup('health', 1200, 620));
  state.pickups.push(makePickup('ammo', 1500, 860));
  state.pickups.push(makePickup('cash', 1100, 900));
  // A cab waiting at the hotel for mission one.
  const cab = makeCar(1, 1344, 780, -Math.PI / 2, 'parked');
  state.parked.push(cab);
  // The pink Coupe at the stadium for mission two.
  const coupe = makeCar(3, 1728, 500, 0, 'parked');
  coupe.color = '#ff2e88';
  state.parked.push(coupe);

  const saved = loadSave();
  if (saved) {
    state.player.cash = saved.cash || 0;
    state.missions.index = clamp(saved.missionIndex || 0, 0, CAMPAIGN.length - 1);
  }
  state.camera.x = 1344; state.camera.y = 720;
  if (SCENE) stageScene(SCENE);
  fit();
  window.addEventListener('resize', fit);
  requestAnimationFrame(loop);
}

function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  canvas.style.width = Math.floor(1280 * scale) + 'px';
  canvas.style.height = Math.floor(720 * scale) + 'px';
}

// Stage a fixed scene for screenshots (?scene=...) — deterministic setups.
function stageScene(scene) {
  const w = state.world, p = state.player;
  if (scene === 'title') { state.screen = 'title'; return; }
  state.screen = 'play';
  if (scene === 'cover') {
    // A three-star chase down Ocean Drive: the cover shot.
    state.missions.index = 4; state.missions.step = 1; state.missions.phase = 'active';
    state.wanted = 3;
    spawnPlayerCar(3, 2720, 1500, -Math.PI / 2);
    state.player.car.speed = 420;
    state.player.car.color = '#ff2e88';
    for (let i = 0; i < 3; i++) {
      const pc = spawnPolice(w, state.rng, p);
      pc.x = 2720 + (i - 1) * 40; pc.y = 1500 + 150 + i * 110;
      pc.angle = -Math.PI / 2; pc.speed = 460;
      state.policeCars.push(pc);
    }
    state.waypoint = { x: w.places.safehouse.x, y: w.places.safehouse.y, label: 'Safehouse' };
    state.camera.x = 2720; state.camera.y = 1450;
  } else if (scene === 'mission') {
    state.missions.index = 0; state.missions.step = 1; state.missions.phase = 'active';
    spawnPlayerCar(1, 1344, 780, -Math.PI / 2);
    state.dialogue = { speaker: 'ROSA', text: 'First job: pick up my cousin at the Old Market and drop her at the Pier.', shown: 'First job: pick up my cousin at the Old Market and drop her at the Pier.' };
    state.waypoint = { x: w.places.market.x, y: w.places.market.y, label: 'Old Market' };
    state.camera.x = 1344; state.camera.y = 720;
  } else if (scene === 'beach') {
    state.missions.phase = 'idle';
    spawnPlayerCar(3, 2720, 1700, Math.PI / 2);
    state.player.car.speed = 300;
    state.player.car.color = '#00e5ff';
    for (let i = 0; i < 5; i++) state.peds.push(makePed(w, state.rng, 2850, 1500));
    state.waypoint = { x: w.places.pier.x, y: w.places.pier.y, label: 'Pier' };
    state.camera.x = 2720; state.camera.y = 1650;
  } else if (scene === 'drive') {
    state.missions.phase = 'idle';
    state.wanted = 1;
    spawnPlayerCar(0, 1344, 720, 0);
    state.player.car.speed = 260;
    const pc = spawnPolice(w, state.rng, p);
    pc.x = 1100; pc.y = 720; pc.angle = 0; pc.speed = 300;
    state.policeCars.push(pc);
    state.waypoint = { x: w.places.stadium.x, y: w.places.stadium.y, label: 'Stadium' };
    state.camera.x = 1344; state.camera.y = 720;
  }
}

let last = performance.now();
function loop(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  state.time += dt;
  state.stats.time += dt;
  update(dt);
  render();
  state.input.endFrame();
  requestAnimationFrame(loop);
}

function update(dt) {
  const inp = state.input;
  if (inp.pressed('KeyM')) { state.audio.muted = !state.audio.muted; }
  if (inp.keys.size > 0 || inp.mouse.clicked) state.audio.ensure();

  if (state.screen === 'title') {
    // Slow cinematic pan over downtown.
    state.camera.x = 1600 + Math.sin(state.time * 0.05) * 500;
    state.camera.y = 1100 + Math.cos(state.time * 0.04) * 300;
    if (inp.pressed('ArrowDown') || inp.pressed('KeyS')) state.menuSel = (state.menuSel + 1) % 3;
    if (inp.pressed('ArrowUp') || inp.pressed('KeyW')) state.menuSel = (state.menuSel + 2) % 3;
    if (inp.mouse.clicked) {
      const mx = inp.mouse.x, my = inp.mouse.y;
      for (let i = 0; i < 3; i++) {
        if (mx >= 470 && mx <= 810 && my >= 380 + i * 56 && my <= 424 + i * 56) { state.menuSel = i; activateMenu(); }
      }
    }
    if (inp.pressed('Enter')) activateMenu();
    if (state.showHelp && (inp.pressed('Escape') || inp.pressed('Enter'))) state.showHelp = false;
    return;
  }
  if (state.screen === 'briefing') {
    if (state.dialogue) {
      state.dialogueT += dt;
      state.dialogue.shown = state.dialogue.text.slice(0, Math.floor(state.dialogueT * 45));
    }
    if (inp.pressed('Enter') || inp.mouse.clicked) {
      state.audio.sfx('click');
      state.missions.nextBriefLine();
      if (state.missions.phase === 'active') { state.screen = 'play'; state.dialogue = null; }
      else setDialogue();
    }
    return;
  }
  if (state.screen === 'paused') {
    if (inp.pressed('Enter') || inp.pressed('Escape') || inp.pressed('KeyP')) state.screen = 'play';
    if (inp.pressed('KeyR')) retryMission();
    if (inp.pressed('KeyQ')) { state.screen = 'title'; state.showHelp = false; }
    return;
  }
  if (state.screen === 'busted' || state.screen === 'wasted') {
    if (inp.pressed('Enter')) retryMission();
    return;
  }
  if (state.screen === 'complete') {
    if (inp.pressed('Enter')) { state.screen = 'play'; state.missions.phase = 'idle'; state.dialogue = null; }
    return;
  }
  // --- play ---
  if (inp.pressed('KeyP') || inp.pressed('Escape')) { state.screen = 'paused'; return; }
  if (inp.pressed('Digit1')) state.player.weapon = 'fists';
  if (inp.pressed('Digit2')) state.player.weapon = 'pistol';

  state.crimeThisFrame = false;
  updatePlayer(dt);
  updateTrafficAll(dt);
  updatePeds(state.peds, dt, state.world, state.rng, state.player, false);
  updatePoliceAll(dt);
  const events = updateBullets(state.bullets, dt, state.world, state.peds, allCars(), state.player);
  for (const e of events) {
    if (e.type === 'crime') { addHeat(state, e.heat); state.crimeThisFrame = true; }
    if (e.type === 'playerHit') { state.hurtT = 0.6; state.audio.sfx('punch'); }
    if (e.type === 'spark') addParticle(e.x, e.y, '#ffd166', 4);
  }
  // Ped hit by a car?
  for (const ped of state.peds) {
    if (hitPed(ped, allCars())) {
      const byPlayer = state.player.mode === 'car' && dist(ped.x, ped.y, state.player.x, state.player.y) < 120;
      if (byPlayer) { addHeat(state, 1); state.crimeThisFrame = true; say('You hit a pedestrian!'); }
    }
  }
  const got = updatePickups(state.pickups, dt, state.player);
  for (const k of got) { applyPickup(state.player, k); state.audio.sfx(k === 'cash' ? 'cash' : 'pickup'); if (k === 'cash') say('+$50'); }
  updateWanted(state, dt, state.crimeThisFrame);
  updateMissions(dt);
  updateFare(dt);
  updateParticles(dt);
  updateCamera(state.camera, state.player, dt);
  state.audio.setEngine(state.player.car ? state.player.car.speed : 0, state.player.mode === 'car');
  state.audio.musicTick(dt);
  if (state.messageT > 0) state.messageT -= dt;
  if (state.hurtT > 0) state.hurtT -= dt;
  if (state.player.health <= 0) {
    state.audio.sfx('busted');
    state.screen = 'wasted';
    return;
  }
  state.autosaveT += dt;
  if (state.autosaveT > 20) {
    state.autosaveT = 0;
    writeSave({ missionIndex: state.missions.index, cash: state.player.cash, health: state.player.health, ammo: state.player.ammo });
  }
  // Demo autopilot: if the player idles, the game drives itself.
  if (state.demo) autopilot(dt);
}

function activateMenu() {
  state.audio.ensure();
  state.audio.sfx('click');
  if (state.menuSel === 2) { state.showHelp = true; return; }
  if (state.menuSel === 1 && state.saveExists) {
    const s = loadSave();
    if (s) { state.player.cash = s.cash || 0; }
    state.screen = 'play';
    state.missions.phase = 'idle';
    say('Welcome back to Solmara.');
    return;
  }
  if (state.menuSel === 1) { state.screen = 'play'; state.missions.phase = 'idle'; say('Free roam — find work, stay out of trouble.'); return; }
  startMission(0);
}

function updatePlayer(dt) {
  const inp = state.input, p = state.player, w = state.world;
  state.punchCd -= dt; state.shootCd -= dt;
  if (p.mode === 'foot') {
    let mx = 0, my = 0;
    if (inp.isDown('KeyW') || inp.isDown('ArrowUp')) my -= 1;
    if (inp.isDown('KeyS') || inp.isDown('ArrowDown')) my += 1;
    if (inp.isDown('KeyA') || inp.isDown('ArrowLeft')) mx -= 1;
    if (inp.isDown('KeyD') || inp.isDown('ArrowRight')) mx += 1;
    if (inp.touch.left) mx -= 1;
    if (inp.touch.right) mx += 1;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len; my /= len;
      p.x += mx * 175 * dt;
      p.y += my * 175 * dt;
      p.angle = Math.atan2(my, mx);
    }
    // Aim follows the mouse while shooting.
    const cam = state.camera;
    const wx = cam.x - 640 / cam.zoom + inp.mouse.x / cam.zoom;
    const wy = cam.y - 360 / cam.zoom + inp.mouse.y / cam.zoom;
    if (inp.mouse.down || inp.mouse.clicked) p.angle = Math.atan2(wy - p.y, wx - p.x);
    const fixed = w.resolveBuildings(p.x, p.y, 10);
    p.x = fixed.x; p.y = fixed.y;
    if (w.inSea(p.x)) p.x = 2940;
    p.x = clamp(p.x, 24, 2940); p.y = clamp(p.y, 24, 2376);
    // Enter a car.
    state.nearCar = nearestCarTo(p.x, p.y, 52);
    if (inp.pressed('KeyE') && state.nearCar) {
      const stolen = state.nearCar.driver === 'traffic';
      enterCar(state.nearCar, stolen);
    }
    if (inp.pressed('KeyF') && state.punchCd <= 0) {
      state.punchCd = 0.35;
      if (punch(p, state.peds, allCars())) { state.audio.sfx('punch'); addParticle(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, '#fff', 5); }
    }
    if ((inp.mouse.down || inp.mouse.clicked) && p.weapon === 'pistol' && state.shootCd <= 0) {
      if (p.ammo > 0) {
        p.ammo--;
        state.shootCd = 0.22;
        shoot(state.bullets, p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18, p.angle, 'player');
        state.audio.sfx('shoot');
        addParticle(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, '#ffe66d', 5);
      } else if (state.shootCd <= -0.3) {
        state.shootCd = 0;
        say('Out of ammo — find an ammo box.');
      }
    }
  } else if (p.mode === 'car' && p.car) {
    const car = p.car;
    const throttle = (inp.isDown('KeyW') || inp.isDown('ArrowUp') || inp.touch.gas) ? 1 : 0;
    const brake = (inp.isDown('KeyS') || inp.isDown('ArrowDown') || inp.touch.brake) ? 1 : 0;
    let steer = 0;
    if (inp.isDown('KeyA') || inp.isDown('ArrowLeft') || inp.touch.left) steer -= 1;
    if (inp.isDown('KeyD') || inp.isDown('ArrowRight') || inp.touch.right) steer += 1;
    const before = car.speed;
    const wrecked = car.health <= 0;
    updateCar(car, { throttle: wrecked ? 0 : throttle, steer, brake: inp.isDown('Space') ? 1 : brake }, dt, w, allCars());
    if (Math.abs(before - car.speed) > 160) {
      state.camera.shake = 10;
      state.audio.sfx('crash');
      addParticle(car.x, car.y, '#ffb347', 8);
    }
    if (car.skidding) {
      const bx = car.x - Math.cos(car.angle) * 18, by = car.y - Math.sin(car.angle) * 18;
      if (car._lx !== undefined) state.skids.push({ x1: car._lx, y1: car._ly, x2: bx, y2: by });
      car._lx = bx; car._ly = by;
      if (state.skids.length > 120) state.skids.splice(0, state.skids.length - 120);
      if (Math.random() < 0.4) addParticle(bx, by, 'rgba(200,200,200,0.5)', 6);
    } else { car._lx = undefined; }
    if (car.health < 30 && car.health > 0 && Math.random() < 0.3) addParticle(car.x, car.y - 10, 'rgba(80,80,80,0.7)', 7);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (inp.pressed('KeyE')) {
      if (wrecked) say('The car is wrecked — find another ride.');
      else exitCar();
    }
  }
}

function updateTrafficAll(dt) {
  const p = state.player;
  // Keep the streets busy near the player.
  if (state.traffic.length < 10) {
    state.traffic.push(makeTrafficCar(state.world, state.rng, p.x, p.y));
  }
  state.traffic = state.traffic.filter((c) => dist(c.x, c.y, p.x, p.y) < 1300 && c.health > -40);
  for (const c of state.traffic) updateTraffic(c, dt, state.world, state.rng, p, allCars());
  if (state.peds.length < 18) state.peds.push(makePed(state.world, state.rng, p.x, p.y));
  state.peds = state.peds.filter((pd) => dist(pd.x, pd.y, p.x, p.y) < 1000);
}

function updatePoliceAll(dt) {
  const p = state.player;
  const want = wantedTargetCount(state.wanted);
  state.policeTimer -= dt;
  if (state.policeCars.length < want && state.policeTimer <= 0) {
    state.policeCars.push(spawnPolice(state.world, state.rng, p));
    state.policeTimer = 1.4;
    if (state.wanted >= 2) state.audio.sfx('siren');
  }
  state.policeCars = state.policeCars.filter((c) => c.health > -40 && (state.wanted > 0 || dist(c.x, c.y, p.x, p.y) < 900));
  let touching = false;
  for (const c of state.policeCars) {
    if (c.block) continue; // roadblock cars hold position
    if (updatePolice(c, dt, state.world, p, allCars()) === 'touching') touching = true;
  }
  if (touching) {
    state.bustedT += dt;
    if (state.bustedT > 1.5) {
      state.audio.sfx('busted');
      state.screen = 'busted';
      return;
    }
  } else state.bustedT = Math.max(0, state.bustedT - dt * 2);
  // Roadblocks at high heat.
  state.roadblockTimer -= dt;
  if (state.wanted >= 4 && state.roadblockTimer <= 0) {
    const block = makeRoadblock(state.world, state.rng, p);
    state.policeCars.push(...block);
    state.roadblockTimer = 22;
    say('Roadblock ahead!');
  }
}

function updateMissions(dt) {
  const before = state.missions.phase;
  const wp = state.missions.update(state, dt);
  if (wp) state.waypoint = { x: wp.x, y: wp.y, label: wp.label };
  else if (!state.fare) state.waypoint = null;
  if (before === 'active' && state.missions.phase === 'idle') {
    state.stats.earned += state.missions.mission ? 0 : 0;
    state.audio.sfx('mission');
    writeSave({ missionIndex: state.missions.index, cash: state.player.cash, health: state.player.health, ammo: state.player.ammo });
    if (state.missions.index < CAMPAIGN.length) {
      say('Next job unlocked — talk to Rosa. (Press N)');
    }
  }
  if (before === 'active' && state.missions.phase === 'campaignDone') {
    state.audio.sfx('mission');
    writeSave({ missionIndex: CAMPAIGN.length, cash: state.player.cash, health: state.player.health, ammo: state.player.ammo });
    state.screen = 'complete';
  }
  // N starts the next mission from free roam.
  if (state.missions.phase === 'idle' && state.input.pressed('KeyN') && state.missions.index < CAMPAIGN.length) {
    startMission(state.missions.index);
  }
}

function updateFare(dt) {
  if (state.missions.phase !== 'idle' || state.screen !== 'play') return;
  if (!state.fare) {
    state.fareTimer -= dt;
    if (state.fareTimer <= 0) {
      state.fare = spawnFare(state.world, state.rng, state.player);
      state.waypoint = { x: state.fare.from.x, y: state.fare.from.y, label: 'Fare' };
      say('Fare waiting at ' + state.fare.from.label + ' — drive over.');
    }
    return;
  }
  const f = state.fare;
  const target = f.picked ? f.to : f.from;
  state.waypoint = { x: target.x, y: target.y, label: f.picked ? 'Drop-off' : 'Fare' };
  if (dist(state.player.x, state.player.y, target.x, target.y) < 62 && state.player.mode === 'car') {
    if (!f.picked) {
      f.picked = true;
      state.audio.sfx('pickup');
      say('Passenger aboard — take them to ' + f.to.label + '.');
    } else {
      state.player.cash += f.pay;
      state.stats.earned += f.pay;
      state.audio.sfx('cash');
      say('Fare complete — +$' + f.pay);
      state.fare = null;
      state.fareTimer = 10;
      state.waypoint = null;
    }
  }
}

function autopilot(dt) {
  const p = state.player;
  const inp = state.input;
  const busy = inp.keys.size > 0 || inp.mouse.down;
  if (busy || state.screen !== 'play') return;
  const target = state.waypoint || state.world.nodes[state.world.nearestNode(p.x + 400, p.y)];
  if (p.mode === 'foot') {
    const car = nearestCarTo(p.x, p.y, 200);
    if (car) enterCar(car, false);
    return;
  }
  if (!p.car) return;
  const want = Math.atan2(target.y - p.y, target.x - p.x);
  const steer = clamp(angleDiff(p.angle, want) * 2.4, -1, 1);
  const d = dist(p.x, p.y, target.x, target.y);
  updateCar(p.car, { throttle: d > 40 ? 0.75 : 0, steer, brake: 0 }, dt, state.world, allCars());
  p.x = p.car.x; p.y = p.car.y; p.angle = p.car.angle;
}

function addParticle(x, y, color, size) {
  if (state.particles.length > 220) return;
  state.particles.push({
    x, y,
    vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60,
    life: 0.5, max: 0.5, color, size: size || 4,
  });
}

function updateParticles(dt) {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
}

function render() {
  ctx.clearRect(0, 0, 1280, 720);
  drawWorld(ctx, state, state.time);
  if (state.screen === 'play' || state.screen === 'paused' || state.screen === 'busted' || state.screen === 'wasted' || state.screen === 'briefing' || state.screen === 'complete') {
    drawHUD(ctx, state);
  }
  if (state.screen === 'title') drawTitle(ctx, state);
  if (state.screen === 'briefing') drawBriefing(ctx, state);
  if (state.screen === 'paused') drawPause(ctx);
  if (state.screen === 'busted') drawEndCard(ctx, 'BUSTED', 'The Solmara PD caught you. Rosa is not happy.', 'Press ENTER to retry the mission  •  -$100');
  if (state.screen === 'wasted') drawEndCard(ctx, 'WASTED', 'Dana is down. Solmara keeps moving without you.', 'Press ENTER to retry the mission  •  -$100');
  if (state.screen === 'complete') drawComplete(ctx, state);
  if (state.showHelp && state.screen === 'title') {
    ctx.fillStyle = 'rgba(8,12,24,0.92)';
    ctx.fillRect(240, 120, 800, 480);
    ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 2;
    ctx.strokeRect(240, 120, 800, 480);
    ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', 640, 175);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'left';
    const lines = [
      'WASD / arrows — drive and walk.  E — get in / out of a car.',
      'F — punch.  Mouse — aim, click — shoot.  1 / 2 — fists / pistol.',
      'SPACE — handbrake.  P — pause.  M — mute.  N — start the next job.',
      '',
      'Steal cars, take fares, run missions for Rosa. Earn cash,',
      'stay ahead of the Solmara PD — and keep your wanted level down.',
      'Five missions stand between Dana and a clean getaway.',
      '',
      'Touch: left side steers, right side is gas and brake.',
    ];
    lines.forEach((ln, i) => ctx.fillText(ln, 290, 220 + i * 30));
    ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to go back', 640, 560);
  }
}

init();
