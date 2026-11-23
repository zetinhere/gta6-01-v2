// render.js — everything the player sees: the sun-soaked city, the sea, the
// cars and people in it, and the juice (skids, dust, muzzle flashes). The
// camera follows the player with a soft lag and shakes on impacts.
import { clamp, lerp, TAU } from './util.js';
import { WORLD_W, WORLD_H, ROAD_W, ROADS_V, ROADS_H, SEA_X, BEACH_X, OCEAN_DRIVE_X } from './world.js';

export function makeCamera() {
  return { x: 1600, y: 1200, zoom: 1, shake: 0 };
}

export function updateCamera(cam, player, dt) {
  const tx = clamp(player.x, 420, WORLD_W - 420);
  const ty = clamp(player.y, 300, WORLD_H - 300);
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, ty, 1 - Math.pow(0.001, dt));
  const targetZoom = player.mode === 'car' ? 0.82 : 1.0;
  cam.zoom = lerp(cam.zoom, targetZoom, dt * 1.5);
  cam.shake = Math.max(0, cam.shake - dt * 26);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car, isPlayer, t) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -m.len / 2 + 3, -m.wid / 2 + 4, m.len, m.wid, 7);
  ctx.fill();
  // wheels
  ctx.fillStyle = '#16181d';
  const wy = m.wid / 2 - 2;
  ctx.fillRect(-m.len * 0.32, -wy - 3, 12, 5);
  ctx.fillRect(m.len * 0.22, -wy - 3, 12, 5);
  ctx.fillRect(-m.len * 0.32, wy - 2, 12, 5);
  ctx.fillRect(m.len * 0.22, wy - 2, 12, 5);
  // body
  ctx.fillStyle = car.color;
  roundRect(ctx, -m.len / 2, -m.wid / 2, m.len, m.wid, 7);
  ctx.fill();
  // roof + windshield
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -m.len * 0.12, -m.wid / 2 + 4, m.len * 0.34, m.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(m.len * 0.26, -m.wid / 2 + 4, 3, m.wid - 8);
  // police livery
  if (car.driver === 'police') {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(-m.len * 0.1, -m.wid / 2, m.len * 0.2, m.wid);
    ctx.fillStyle = (Math.floor(t * 4) % 2 === 0) ? '#ff2e63' : '#2e86ff';
    ctx.fillRect(-6, -m.wid / 2 + 2, 12, 5);
    ctx.fillStyle = (Math.floor(t * 4) % 2 === 0) ? '#2e86ff' : '#ff2e63';
    ctx.fillRect(-6, m.wid / 2 - 7, 12, 5);
  }
  if (car.model.name === 'Taxi Cab') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -m.len / 2 - 3, -m.wid / 2 - 3, m.len + 6, m.wid + 6, 9);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawWorld(ctx, state, t) {
  const { world, camera } = state;
  const vw = 1280 / camera.zoom, vh = 720 / camera.zoom;
  const sx = (Math.random() - 0.5) * camera.shake;
  const sy = (Math.random() - 0.5) * camera.shake;
  const ox = camera.x - vw / 2 + sx, oy = camera.y - vh / 2 + sy;
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-ox, -oy);

  // Ground: warm grass base.
  ctx.fillStyle = '#a9cf8f';
  ctx.fillRect(ox - 40, oy - 40, vw + 80, vh + 80);

  // Sea (east) with slow waves.
  const seaGrad = ctx.createLinearGradient(SEA_X, 0, WORLD_W, 0);
  seaGrad.addColorStop(0, '#2ec4b6');
  seaGrad.addColorStop(1, '#1273a8');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(Math.max(SEA_X, ox - 40), oy - 40, WORLD_W - Math.max(SEA_X, ox - 40) + 40, vh + 80);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const wy = oy + ((t * 24 + i * 170) % (vh + 80));
    ctx.beginPath();
    for (let x = SEA_X + 8; x < WORLD_W; x += 46) {
      const y = wy + Math.sin((x + t * 40 + i * 90) * 0.02) * 5;
      if (x === SEA_X + 8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Beach sand.
  ctx.fillStyle = '#f2d8a0';
  ctx.fillRect(Math.max(BEACH_X, ox - 40), oy - 40, SEA_X - Math.max(BEACH_X, ox - 40), vh + 80);
  ctx.fillStyle = 'rgba(180,140,80,0.5)';
  for (let i = 0; i < 40; i++) {
    const px = BEACH_X + ((i * 137) % (SEA_X - BEACH_X));
    const py = oy + ((i * 211) % (vh + 80));
    ctx.fillRect(px, py, 3, 2);
  }

  // City blocks: pavement slabs.
  ctx.fillStyle = '#d9c9a8';
  for (let i = 0; i < ROADS_V.length - 1; i++) {
    for (let j = 0; j < ROADS_H.length - 1; j++) {
      const x0 = ROADS_V[i] + ROAD_W / 2, x1 = ROADS_V[i + 1] - ROAD_W / 2;
      const y0 = ROADS_H[j] + ROAD_W / 2, y1 = ROADS_H[j + 1] - ROAD_W / 2;
      if (x1 < ox - 40 || x0 > ox + vw + 40 || y1 < oy - 40 || y0 > oy + vh + 40) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  // Parks.
  for (const p of world.parks) {
    ctx.fillStyle = '#7fbf6a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Roads.
  ctx.fillStyle = '#565b66';
  for (const vx of ROADS_V) ctx.fillRect(vx - ROAD_W / 2, oy - 40, ROAD_W, vh + 80);
  for (const hy of ROADS_H) ctx.fillRect(ox - 40, hy - ROAD_W / 2, vw + 80, ROAD_W);
  // Ocean Drive is wider and warmer.
  ctx.fillStyle = '#6b5a44';
  ctx.fillRect(OCEAN_DRIVE_X - 40, oy - 40, 80, vh + 80);
  // Centre dashes.
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  for (const vx of ROADS_V) { ctx.beginPath(); ctx.moveTo(vx, oy - 40); ctx.lineTo(vx, oy + vh + 40); ctx.stroke(); }
  for (const hy of ROADS_H) { ctx.beginPath(); ctx.moveTo(ox - 40, hy); ctx.lineTo(ox + vw + 40, hy); ctx.stroke(); }
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(245,240,225,0.85)';
  for (const vx of ROADS_V) for (const hy of ROADS_H) {
    for (let k = -2; k <= 2; k++) ctx.fillRect(vx + k * 12 - 4, hy - ROAD_W / 2 - 8, 8, 6);
  }

  // Buildings with a fake-height shadow and lit windows.
  for (const b of world.buildings) {
    if (b.x > ox + vw + 60 || b.x + b.w < ox - 60 || b.y > oy + vh + 60 || b.y + b.h < oy - 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, 7);
    ctx.fillStyle = 'rgba(30,45,70,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 22)), rows = Math.max(1, Math.floor(b.h / 24));
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      if ((c * 7 + r * 13 + b.floors) % 3 === 0) ctx.fillStyle = '#ffd166';
      else ctx.fillStyle = 'rgba(30,45,70,0.85)';
      ctx.fillRect(b.x + 6 + c * 22, b.y + 12 + r * 24, 11, 13);
    }
  }
  // Trees and palms.
  for (const tr of world.trees) {
    ctx.fillStyle = '#3f9e4d';
    ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c7a38';
    ctx.beginPath(); ctx.arc(tr.x - 3, tr.y - 3, tr.r * 0.55, 0, TAU); ctx.fill();
  }
  for (const p of world.palms) {
    ctx.strokeStyle = '#8a6f4d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y + 6); ctx.lineTo(p.x, p.y - 8); ctx.stroke();
    ctx.strokeStyle = '#2fa866'; ctx.lineWidth = 2.5;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 0.4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 8);
      ctx.quadraticCurveTo(p.x + Math.cos(a) * 12, p.y - 8 + Math.sin(a) * 12 - 6, p.x + Math.cos(a) * 17, p.y - 8 + Math.sin(a) * 17 + 4);
      ctx.stroke();
    }
  }
  // Street lamps.
  ctx.fillStyle = '#3c4250';
  for (const l of world.lamps) ctx.fillRect(l.x, l.y, 3, 10);

  // Pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(pk.bob * 3) * 3;
    if (pk.kind === 'health') {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.fillRect(pk.x - 2, pk.y - 7 + bob, 4, 14);
      ctx.fillRect(pk.x - 7, pk.y - 2 + bob, 14, 4);
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(pk.x - 10, pk.y - 7 + bob, 20, 14);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('AMMO', pk.x, pk.y + 3 + bob);
    } else {
      ctx.fillStyle = '#27ae60';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 10, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    }
  }

  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,25,0.4)';
  ctx.lineWidth = 4;
  for (const s of state.skids) {
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }

  // Peds.
  for (const p of state.peds) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 7, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = p.pants;
    ctx.fillRect(p.x - 4, p.y + 1, 8, 8);
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(p.x, p.y - 2, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(p.x, p.y - 8, 4.5, 0, TAU); ctx.fill();
  }

  // Cars: traffic, police, then the player's car on top.
  for (const c of state.traffic) drawCarShape(ctx, c, false, t);
  for (const c of state.policeCars) drawCarShape(ctx, c, false, t);
  if (state.player.mode === 'car' && state.player.car) drawCarShape(ctx, state.player.car, true, t);

  // Player on foot.
  if (state.player.mode === 'foot') {
    const p = state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 8, 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(p.x - 5, p.y + 1, 10, 10);
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath(); ctx.arc(p.x, p.y - 3, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.beginPath(); ctx.arc(p.x, p.y - 9, 5, 0, TAU); ctx.fill();
    // Aim tick.
    ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20); ctx.stroke();
  }

  // Bullets as tracers.
  ctx.strokeStyle = '#ffe66d'; ctx.lineWidth = 2;
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles: dust, sparks, muzzle flashes.
  for (const pt of state.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Waypoint: a bouncing gold diamond with a beam.
  const wp = state.waypoint;
  if (wp) {
    const bob = Math.sin(t * 4) * 6;
    ctx.strokeStyle = 'rgba(255,210,31,0.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(wp.x, wp.y - 60 + bob); ctx.lineTo(wp.x, wp.y + 10); ctx.stroke();
    ctx.fillStyle = '#ffd21f';
    ctx.save();
    ctx.translate(wp.x, wp.y - 46 + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
    ctx.fillStyle = '#1d3557';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(wp.label || '', wp.x, wp.y - 68 + bob);
  }

  // Warm sunlight wash + soft vignette.
  const sun = ctx.createRadialGradient(camera.x, camera.y - 200, 100, camera.x, camera.y, 900);
  sun.addColorStop(0, 'rgba(255,240,180,0.10)');
  sun.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(ox - 40, oy - 40, vw + 80, vh + 80);

  ctx.restore();
}
