// Santa Brisa Rush — renderer: everything the player sees, drawn on one 2D
// canvas. Top-down sun-soaked city: green blocks, grey avenues, sand and sea
// along the Boardwalk, flat-shaded buildings, traffic, walkers, cops, and the
// effects of a chase.

import { WORLD_W, WORLD_H, ROAD_W, isBeach } from './city.js';
import { clamp } from './rng.js';

const VIEW_W = 1280;
const VIEW_H = 800;

function drawCarBody(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.model === 'van' ? 52 : car.model === 'pickup' ? 48 : 44;
  const wid = 24;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  ctx.beginPath();
  ctx.roundRect(-len / 2 + 10, -wid / 2 + 4, 12, wid - 8, 3);
  ctx.fill();
  if (car.model === 'pickup') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(len / 2 - 14, -wid / 2 + 3, 11, wid - 6);
  }
  ctx.fillStyle = '#ffd23d';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 4);
  ctx.fillRect(len / 2 - 3, wid / 2 - 6, 3, 4);
  ctx.fillStyle = '#ff5a3d';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 4);
  ctx.fillRect(-len / 2, wid / 2 - 6, 3, 4);
  if (car.police) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-6, -wid / 2 + 1, 12, wid - 2);
    ctx.fillStyle = '#1c5fd6';
    ctx.fillRect(-6, -wid / 2 + 1, 12, 5);
    ctx.fillStyle = '#e84c4c';
    ctx.fillRect(-6, wid / 2 - 6, 12, 5);
    ctx.fillStyle = '#1c1c1c';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  if (car.model === 'taxi') {
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  ctx.restore();
}

export function drawWorld(ctx, G) {
  const cam = G.cam;
  const x0 = Math.max(0, cam.x - 40);
  const y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD_W, cam.x + VIEW_W + 40);
  const y1 = Math.min(WORLD_H, cam.y + VIEW_H + 40);

  ctx.fillStyle = '#7ec850';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  ctx.fillStyle = '#f2d38a';
  ctx.fillRect(x0, Math.max(y0, G.world.beachTop), x1 - x0, y1 - Math.max(y0, G.world.beachTop));
  ctx.fillStyle = '#2f9fd6';
  ctx.fillRect(x0, WORLD_H - 46, x1 - x0, 46);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let wx = 120; wx < WORLD_W; wx += 260) {
    ctx.fillRect(wx, WORLD_H - 40, 90, 4);
  }

  for (const ax of G.world.avenues) {
    if (ax + ROAD_W / 2 < x0 || ax - ROAD_W / 2 > x1) continue;
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(ax - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    ctx.fillStyle = '#ffd23d';
    for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) {
      ctx.fillRect(ax - 2, y, 4, 22);
    }
  }
  for (const sy of G.world.streets) {
    if (sy + ROAD_W / 2 < y0 || sy - ROAD_W / 2 > y1) continue;
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(x0, sy - ROAD_W / 2, x1 - x0, ROAD_W);
    ctx.fillStyle = '#ffd23d';
    for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) {
      ctx.fillRect(x, sy - 2, 22, 4);
    }
  }

  for (const b of G.world.buildings) {
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = 'rgba(20,30,50,0.7)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 8 + i * 34, b.y + 12 + j * 34, 16, 12);
      }
    }
  }

  ctx.strokeStyle = '#2d8a3d';
  ctx.lineWidth = 3;
  for (const palm of G.world.palms) {
    if (palm.x < x0 || palm.x > x1 || palm.y < y0 || palm.y > y1) continue;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + palm.lean * 20, palm.y - 16);
    ctx.stroke();
    ctx.fillStyle = '#37b24d';
    ctx.beginPath();
    ctx.arc(palm.x + palm.lean * 20, palm.y - 18, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ffd23d';
  for (const lamp of G.world.lamps) {
    if (lamp.x < x0 || lamp.x > x1 || lamp.y < y0 || lamp.y > y1) continue;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawEntities(ctx, G) {
  for (const w of G.walkers) {
    if (w.x < G.cam.x - 40 || w.x > G.cam.x + VIEW_W + 40) continue;
    if (w.y < G.cam.y - 40 || w.y > G.cam.y + VIEW_H + 40) continue;
    ctx.save();
    ctx.translate(w.x, w.y);
    if (w.down > 0) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = w.skin;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = w.shirt;
      ctx.fillRect(-8, -5, 16, 10);
      ctx.restore();
      continue;
    }
    ctx.rotate(w.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = w.skin;
    ctx.beginPath();
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (w.panic > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', w.x, w.y - 16);
    }
  }

  for (const car of G.cars) {
    if (car.x < G.cam.x - 80 || car.x > G.cam.x + VIEW_W + 80) continue;
    if (car.y < G.cam.y - 80 || car.y > G.cam.y + VIEW_H + 80) continue;
    drawCarBody(ctx, car);
  }

  for (const b of G.bullets) {
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life * 2.4, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const p = G.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.onFoot) {
    ctx.rotate(p.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9a06a';
    ctx.beginPath();
    ctx.arc(9, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111111';
    ctx.fillRect(4, -3, 12, 3);
    if (p.punchAnim > 0) {
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath();
      ctx.arc(24, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    const near = G.cars.find((c) => !c.police && !c.roadblock && Math.hypot(c.x - p.x, c.y - p.y) < 70);
    if (near) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('E — get in', p.x, p.y - 26);
    }
  } else {
    ctx.restore();
    ctx.strokeStyle = '#ffd23d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawObjectiveMarker(ctx, G) {
  let target = null;
  let color = '#ffd23d';
  if (G.mission) {
    target = G.mission.target;
    color = '#ff5a3d';
  } else if (G.taxi.active) {
    target = G.taxi.phase === 'toPickup' ? G.taxi.pickup : G.taxi.dest;
    color = '#ffd23d';
  }
  if (!target) return;
  const pulse = 26 + Math.sin(G.tick * 0.12) * 6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(target.x, target.y - pulse - 14);
  ctx.lineTo(target.x - 8, target.y - pulse - 2);
  ctx.lineTo(target.x + 8, target.y - pulse - 2);
  ctx.closePath();
  ctx.fill();
  const p = G.player;
  const a = Math.atan2(target.y - p.y, target.x - p.x);
  const ex = p.x + Math.cos(a) * 52;
  const ey = p.y + Math.sin(a) * 52;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -7);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(Math.hypot(target.x - p.x, target.y - p.y))}m`, target.x, target.y - pulse - 20);
}
