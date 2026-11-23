// combat.js — on-foot fighting, shooting and the pickups that keep Dana alive.
//
// The player punches with F and shoots with the mouse (click to fire, aim
// follows the cursor). Bullets are plain objects; the render step draws them
// as tracers. Pickups are health crosses, ammo boxes and dropped cash.
import { clamp, dist } from './util.js';

export function makeBullets() { return []; }

export function shoot(bullets, x, y, angle, from) {
  bullets.push({ x, y, angle, speed: 900, life: 0.9, from });
  return { fired: true };
}

export function punch(player, peds, cars) {
  const px = player.x + Math.cos(player.angle) * 26;
  const py = player.y + Math.sin(player.angle) * 26;
  let hit = false;
  for (const p of peds) {
    if (p.state !== 'down' && dist(px, py, p.x, p.y) < 26) {
      p.state = 'down'; p.down = 5; hit = true;
    }
  }
  for (const c of cars) {
    if (dist(px, py, c.x, c.y) < 30) { c.health -= 8; hit = true; }
  }
  return hit;
}

export function updateBullets(bullets, dt, world, peds, cars, player) {
  const events = [];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    // Buildings stop bullets.
    for (const bd of world.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { dead = true; events.push({ type: 'spark', x: b.x, y: b.y }); break; }
    }
    if (!dead && b.from === 'player') {
      for (const p of peds) {
        if (p.state !== 'down' && dist(b.x, b.y, p.x, p.y) < 12) {
          p.state = 'down'; p.down = 6; dead = true; events.push({ type: 'crime', heat: 1 }); break;
        }
      }
      if (!dead) for (const c of cars) {
        if (c.driver !== 'player' && dist(b.x, b.y, c.x, c.y) < 20) {
          c.health -= 12; dead = true; events.push({ type: 'crime', heat: 1 }); break;
        }
      }
    }
    if (!dead && b.from !== 'player' && player.mode === 'foot' && dist(b.x, b.y, player.x, player.y) < 12) {
      player.health -= 8; dead = true; events.push({ type: 'playerHit' });
    }
    if (dead) bullets.splice(i, 1);
  }
  return events;
}

export function makePickup(kind, x, y) {
  return { kind, x, y, bob: 0 }; // kind: 'health' | 'ammo' | 'cash'
}

export function updatePickups(pickups, dt, player) {
  const got = [];
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.bob += dt;
    if (dist(p.x, p.y, player.x, player.y) < 30) {
      got.push(p.kind);
      pickups.splice(i, 1);
    }
  }
  return got;
}

export function applyPickup(player, kind) {
  if (kind === 'health') player.health = clamp(player.health + 35, 0, 100);
  if (kind === 'ammo') player.ammo += 24;
  if (kind === 'cash') player.cash += 50;
}
