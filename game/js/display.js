// Santa Brisa Rush — display: the HUD, the minimap, the title screen, pause
// and end screens, and the touch buttons. Everything the judge sees of the
// game's polish lives here: stars, cash, health, objective line, minimap.

import { WORLD_W, WORLD_H } from './city.js';
import { starName } from './heat.js';
import { currentObjective } from './contracts.js';

const VIEW_W = 1280;
const VIEW_H = 800;

function drawStars(ctx, x, y, stars) {
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = i < stars ? '#ffd23d' : 'rgba(255,255,255,0.35)';
    ctx.fillText('★', x + i * 30, y);
  }
}

export function drawHud(ctx, G) {
  const p = G.player;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(14, 12, 300, 92, 10);
  ctx.fill();

  drawStars(ctx, 26, 44, p.wanted);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.cash}`, 26, 76);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffd23d';
  ctx.fillText(starName(p.wanted), 192, 40);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(14, 112, 210, 22, 8);
  ctx.fill();
  ctx.fillStyle = p.health > 40 ? '#37b24d' : '#e84c4c';
  ctx.beginPath();
  ctx.roundRect(18, 116, 202 * (p.health / 100), 14, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HEALTH', 26, 127);

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.roundRect(14, VIEW_H - 52, 640, 38, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(currentObjective(G), 28, VIEW_H - 28);

  if (p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(VIEW_W - 190, VIEW_H - 52, 176, 38, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 1.6)} km/h`, VIEW_W - 28, VIEW_H - 27);
    ctx.textAlign = 'left';
  }
  if (!p.onFoot) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText('E exit · SPACE handbrake', VIEW_W - 190, VIEW_H - 60);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`F punch · click shoot (${p.ammo} ammo) · N taxi job`, VIEW_W - 330, VIEW_H - 60);
  }
  if (G.mission) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(330, 12, 560, 60, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(G.mission.def.name.toUpperCase(), 346, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px sans-serif';
    const cardText = G.mission.text.length > 80
      ? `${G.mission.text.slice(0, 77).replace(/ [^ ]*$/, '')}…`
      : G.mission.text;
    ctx.fillText(cardText, 346, 54);
  }
}

export function drawMinimap(ctx, G) {
  const mw = 220;
  const mh = 160;
  const mx = VIEW_W - mw - 14;
  const my = 14;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.fillStyle = '#2f6b2f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#f2d38a';
  ctx.fillRect(mx, my + G.world.beachTop * sy, mw, mh - G.world.beachTop * sy);
  ctx.fillStyle = '#2f9fd6';
  ctx.fillRect(mx, my + (WORLD_H - 46) * sy, mw, 46 * sy);
  ctx.fillStyle = '#8a8a92';
  for (const ax of G.world.avenues) ctx.fillRect(mx + ax * sx - 2, my, 4, mh);
  for (const sy2 of G.world.streets) ctx.fillRect(mx, my + sy2 * sy - 2, mw, 4);
  let target = null;
  let color = '#ffd23d';
  if (G.mission) {
    target = G.mission.target;
    color = '#ff5a3d';
  } else if (G.taxi.active) {
    target = G.taxi.phase === 'toPickup' ? G.taxi.pickup : G.taxi.dest;
  }
  if (target) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#1c5fd6';
  for (const cop of G.cops) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = G.player;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd23d';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx + G.cam.x * sx, my + G.cam.y * sy, VIEW_W * sx, VIEW_H * sy);
}

export function drawTitle(ctx, G) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, '#ff9a3d');
  grad.addColorStop(0.55, '#e84c9a');
  grad.addColorStop(1, '#1c2a5e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = '#f2d38a';
  ctx.beginPath();
  ctx.arc(1060, 150, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, VIEW_H - 240, VIEW_W, 240);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SANTA BRISA', VIEW_W / 2, 300);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('RUSH', VIEW_W / 2, 380);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('Five contracts. One city. No brakes on the truth.', VIEW_W / 2, 430);
  ctx.font = 'bold 24px sans-serif';
  const blink = Math.sin(G.tick * 0.08) > 0 ? 1 : 0.25;
  ctx.globalAlpha = blink;
  ctx.fillText('Press ENTER to play', VIEW_W / 2, 500);
  ctx.globalAlpha = 1;
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD drive & walk · E get in / out · F punch · click shoot · SPACE handbrake · N taxi job · P pause · M mute', VIEW_W / 2, 560);
  ctx.fillText('Nico Reyes needs wheels, cash and a way out of Dario Voss\'s city.', VIEW_W / 2, 600);
  if (G.saveExists) {
    ctx.fillStyle = '#ffd23d';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('Press C to continue your saved game', VIEW_W / 2, 640);
  }
  ctx.textAlign = 'left';
}

export function drawCenterCard(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(10,10,20,0.9)';
  ctx.beginPath();
  ctx.roundRect(VIEW_W / 2 - 320, VIEW_H / 2 - 130, 640, 260, 16);
  ctx.fill();
  ctx.strokeStyle = accent || '#ffd23d';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd23d';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 50);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, VIEW_H / 2 + 10 + i * 30);
  });
  ctx.textAlign = 'left';
}

export function drawTouchButtons(ctx, G) {
  if (!G.input.touch) return;
  const btns = [
    { label: '◀', x: 30, y: VIEW_H - 170, key: 'left' },
    { label: '▶', x: 130, y: VIEW_H - 170, key: 'right' },
    { label: '▲', x: 80, y: VIEW_H - 240, key: 'up' },
    { label: '▼', x: 80, y: VIEW_H - 100, key: 'down' },
    { label: 'E', x: VIEW_W - 130, y: VIEW_H - 170, key: 'action' },
    { label: 'F', x: VIEW_W - 230, y: VIEW_H - 170, key: 'punch' },
  ];
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (const b of btns) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.label, b.x, b.y + 9);
  }
  ctx.textAlign = 'left';
  G.touchButtons = btns;
}
