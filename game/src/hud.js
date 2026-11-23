// hud.js — the HUD, the minimap, the dialogue box and every menu screen.
// All drawing is in screen space (1280x720) on top of the world render.
import { clamp, TAU, fmtCash, dist } from './util.js';
import { WORLD_W, WORLD_H, SEA_X, BEACH_X, ROADS_V, ROADS_H } from './world.js';
import { heatForWanted } from './police.js';

function pill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function stars(ctx, x, y, n) {
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd21f' : 'rgba(255,255,255,0.28)';
    ctx.fillText('★', x + i * 26, y);
  }
}

function drawMinimap(ctx, state) {
  const mw = 196, mh = 148, mx = 1280 - mw - 14, my = 720 - mh - 14;
  const sx = mw / WORLD_W, sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,28,0.82)';
  pill(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  // Sea + beach.
  ctx.fillStyle = '#1d7fa8';
  ctx.fillRect(mx + SEA_X * sx, my, (WORLD_W - SEA_X) * sx, mh);
  ctx.fillStyle = '#f2d8a0';
  ctx.fillRect(mx + BEACH_X * sx, my, (SEA_X - BEACH_X) * sx, mh);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  for (const vx of ROADS_V) { ctx.beginPath(); ctx.moveTo(mx + vx * sx, my); ctx.lineTo(mx + vx * sx, my + mh); ctx.stroke(); }
  for (const hy of ROADS_H) { ctx.beginPath(); ctx.moveTo(mx, my + hy * sy); ctx.lineTo(mx + mw, my + hy * sy); ctx.stroke(); }
  // Waypoint.
  const wp = state.waypoint;
  if (wp) {
    ctx.fillStyle = '#ffd21f';
    ctx.save();
    ctx.translate(mx + wp.x * sx, my + wp.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Police.
  ctx.fillStyle = '#ff2e63';
  for (const c of state.policeCars) { ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, TAU); ctx.fill(); }
  // Traffic.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const c of state.traffic) ctx.fillRect(mx + c.x * sx - 1, my + c.y * sy - 1, 2, 2);
  // Player.
  const p = state.player;
  ctx.fillStyle = '#ffffff';
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawHUD(ctx, state) {
  const p = state.player;
  // Top-left: cash + health + weapon.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  pill(ctx, 14, 12, 210, 88, 10); ctx.fill();
  ctx.fillStyle = '#7dffa8';
  ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(fmtCash(p.cash), 28, 42);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HEALTH', 28, 60);
  ctx.fillStyle = '#333d4d';
  ctx.fillRect(28, 66, 150, 9);
  ctx.fillStyle = p.health > 30 ? '#ff5d5d' : '#ff2e63';
  ctx.fillRect(28, 66, 150 * clamp(p.health / 100, 0, 1), 9);
  ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText(p.weapon === 'pistol' ? `PISTOL  ${p.ammo}` : 'FISTS — press 1 for pistol', 28, 92);

  // Top-right: wanted stars + heat label.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  pill(ctx, 1280 - 210, 12, 196, 52, 10); ctx.fill();
  stars(ctx, 1280 - 196, 40, state.wanted);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(heatForWanted(state.wanted).toUpperCase(), 1280 - 28, 58);

  // Top-centre: current objective (+ timer).
  const o = state.missions.objective;
  if (state.missions.phase === 'active' && o) {
    ctx.font = 'bold 15px sans-serif';
    const label = o.text + (state.missions.timer > 0 ? `  —  ${Math.ceil(state.missions.timer)}s` : '');
    const w = ctx.measureText(label).width + 34;
    ctx.fillStyle = 'rgba(10,16,28,0.78)';
    pill(ctx, 640 - w / 2, 12, w, 34, 12); ctx.fill();
    ctx.fillStyle = '#ffd21f'; ctx.textAlign = 'center';
    ctx.fillText(label, 640, 35);
  }

  // Bottom-left: speed + vehicle + hints.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  pill(ctx, 14, 720 - 62, 220, 48, 10); ctx.fill();
  ctx.fillStyle = '#fff';
  if (p.mode === 'car' && p.car) {
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', 28, 720 - 34);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#ffd21f';
    ctx.fillText(p.car.model.name + '  •  E to get out', 28, 720 - 20);
  } else {
    ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('ON FOOT', 28, 720 - 34);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#ffd21f';
    ctx.fillText(state.nearCar ? 'E — get in the car' : 'WASD move  •  F punch  •  click shoot', 28, 720 - 20);
  }

  // Off-screen waypoint arrow.
  const wp = state.waypoint;
  if (wp && state.screen === 'play') {
    const cam = state.camera;
    const vw = 1280 / cam.zoom, vh = 720 / cam.zoom;
    const ox = cam.x - vw / 2, oy = cam.y - vh / 2;
    if (wp.x < ox + 60 || wp.x > ox + vw - 60 || wp.y < oy + 60 || wp.y > oy + vh - 60) {
      const cx = clamp((wp.x - ox) / vw, 0.06, 0.94) * 1280;
      const cy = clamp((wp.y - oy) / vh, 0.08, 0.92) * 720;
      const a = Math.atan2(wp.y - p.y, wp.x - p.x);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(Math.round(dist(p.x, p.y, wp.x, wp.y) / 10) * 10 + 'm', cx, cy - 16);
    }
  }

  drawMinimap(ctx, state);

  // Toast message.
  if (state.messageT > 0 && state.message) {
    ctx.globalAlpha = clamp(state.messageT, 0, 1);
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    const w = ctx.measureText(state.message).width + 30;
    pill(ctx, 640 - w / 2, 56, w, 30, 10); ctx.fill();
    ctx.fillStyle = '#7dffa8'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(state.message, 640, 76);
    ctx.globalAlpha = 1;
  }

  // Dialogue box.
  if (state.dialogue) {
    const d = state.dialogue;
    ctx.fillStyle = 'rgba(10,16,28,0.88)';
    pill(ctx, 240, 720 - 148, 800, 96, 12); ctx.fill();
    ctx.strokeStyle = '#ffd21f'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(d.speaker, 264, 720 - 118);
    ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
    wrapText(ctx, d.shown, 264, 720 - 92, 752, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText('ENTER ▸', 1016, 720 - 66);
  }

  // Damage flash.
  if (state.hurtT > 0) {
    ctx.fillStyle = `rgba(255,30,60,${clamp(state.hurtT * 0.5, 0, 0.35)})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
  // Low-health pulse.
  if (p.health <= 25 && state.screen === 'play') {
    ctx.fillStyle = `rgba(255,30,60,${0.08 + 0.06 * Math.sin(state.time * 5)})`;
    ctx.fillRect(0, 0, 1280, 720);
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w; yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}

function menuButton(ctx, label, x, y, w, selected) {
  ctx.fillStyle = selected ? '#ffd21f' : 'rgba(10,16,28,0.75)';
  pill(ctx, x, y, w, 44, 10); ctx.fill();
  ctx.fillStyle = selected ? '#1d3557' : '#fff';
  ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 29);
}

export function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(8,12,24,0.45)';
  ctx.fillRect(0, 0, 1280, 720);
  // Sun badge.
  ctx.fillStyle = '#ffd21f';
  ctx.beginPath(); ctx.arc(640, 168, 46, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff5d8f';
  ctx.beginPath(); ctx.arc(640, 168, 46, 0, Math.PI); ctx.fill();
  // Dark panel behind the title so it reads over any street.
  ctx.fillStyle = 'rgba(10,16,28,0.55)';
  pill(ctx, 290, 222, 700, 96, 14); ctx.fill();
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMARA HEAT', 640, 280);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('An open-world crime story — five jobs, one last drive.', 640, 312);
  ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 14px sans-serif';
  ctx.fillText('SOLMARA  •  OCEAN DRIVE  •  5 MISSIONS  •  CARS, COPS & CASH', 640, 340);
  const items = ['▶  START STORY', state.saveExists ? '▶  CONTINUE' : '▶  FREE ROAM', '▶  HOW TO PLAY'];
  items.forEach((label, i) => menuButton(ctx, label, 640 - 170, 380 + i * 56, 340, state.menuSel === i));
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '13px sans-serif';
  ctx.fillText('WASD drive & walk  •  E enter / exit car  •  F punch  •  mouse aim, click shoot  •  P pause  •  M mute', 640, 590);
  ctx.fillText('A game made for make.fun — every street, face and song is original.', 640, 614);
}

export function drawBriefing(ctx, state) {
  const m = state.missions.mission;
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('MISSION ' + (state.missions.index + 1) + ' OF 5', 640, 150);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif';
  ctx.fillText(m.title, 640, 205);
  ctx.fillStyle = '#7dffa8'; ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Reward  ' + fmtCash(m.reward), 640, 236);
  const lines = m.brief;
  lines.forEach((ln, i) => {
    const active = i === state.missions.briefLine;
    ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.45)';
    ctx.font = (active ? 'bold ' : '') + '17px sans-serif';
    ctx.fillText((active ? '▸ ' : '') + ln[0] + ':  ' + ln[1], 640, 300 + i * 34);
  });
  ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Press ENTER to start the job', 640, 300 + lines.length * 34 + 26);
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(8,12,24,0.7)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', 640, 300);
  ctx.font = '17px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('ENTER — resume     R — restart mission     Q — quit to title', 640, 350);
}

export function drawEndCard(ctx, title, sub, hint) {
  ctx.fillStyle = 'rgba(8,12,24,0.78)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = title === 'WASTED' ? '#ff2e63' : '#ffd21f';
  ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(title, 640, 320);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText(sub, 640, 370);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px sans-serif';
  ctx.fillText(hint, 640, 410);
}

export function drawComplete(ctx, state) {
  ctx.fillStyle = 'rgba(8,12,24,0.82)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#ffd21f'; ctx.font = 'bold 56px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMARA IS YOURS', 640, 280);
  ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif';
  ctx.fillText('Five jobs. One last drive. Dana Cruz walks away clean.', 640, 325);
  ctx.fillStyle = '#7dffa8'; ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Cash earned  ' + fmtCash(state.stats.earned) + '     Time  ' + Math.floor(state.stats.time / 60) + 'm ' + Math.floor(state.stats.time % 60) + 's', 640, 370);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '15px sans-serif';
  ctx.fillText('Press ENTER for free roam — Solmara stays open.', 640, 420);
}
