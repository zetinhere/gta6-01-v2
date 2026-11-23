// Santa Brisa Rush — on-foot combat: fists and the pistol.
// F punches the nearest walker or cop car window; mouse aim plus click fires
// the pistol. Every violent act is a crime and raises the heat.

import { dist, angleTo } from './rng.js';
import { knockDownWalker, scareWalkers } from './walkers.js';
import { raiseHeat } from './heat.js';

export function punch(G) {
  const p = G.player;
  if (!p.onFoot || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  p.punchAnim = 0.25;
  G.audio.punch();
  let hitSomething = false;
  for (const w of G.walkers) {
    if (w.down > 0) continue;
    if (dist(p.x, p.y, w.x, w.y) < 52) {
      if (knockDownWalker(w)) {
        hitSomething = true;
        G.stats.pedsHit += 1;
        raiseHeat(G, 1);
      }
    }
  }
  if (p.car) return;
  for (const car of G.cars) {
    if (car.police && dist(p.x, p.y, car.x, car.y) < 60) {
      car.speed = 0;
      hitSomething = true;
      raiseHeat(G, 1);
    }
  }
  if (!hitSomething) {
    G.particles.push({
      x: p.x + Math.cos(p.angle) * 34,
      y: p.y + Math.sin(p.angle) * 34,
      vx: 0, vy: 0, life: 0.18, color: '#ffffff', size: 4,
    });
  }
}

export function shoot(G, tx, ty) {
  const p = G.player;
  if (!p.onFoot || p.ammo <= 0 || p.shootCooldown > 0) return;
  p.shootCooldown = 0.3;
  p.ammo -= 1;
  G.stats.shotsFired += 1;
  const a = angleTo(p.x, p.y, tx, ty);
  p.angle = a;
  G.bullets.push({
    x: p.x + Math.cos(a) * 26,
    y: p.y + Math.sin(a) * 26,
    vx: Math.cos(a) * 900,
    vy: Math.sin(a) * 900,
    life: 0.7,
  });
  G.audio.shot();
  scareWalkers(G.walkers, p.x, p.y, 420);
  raiseHeat(G, 1);
  G.particles.push({
    x: p.x + Math.cos(a) * 30,
    y: p.y + Math.sin(a) * 30,
    vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
    life: 0.14, color: '#ffd23d', size: 6,
  });
}

export function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const w of G.walkers) {
        if (w.down > 0) continue;
        if (dist(b.x, b.y, w.x, w.y) < 14) {
          if (knockDownWalker(w)) {
            G.stats.pedsHit += 1;
            raiseHeat(G, 1);
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of G.cars) {
        if (car.police && dist(b.x, b.y, car.x, car.y) < 26) {
          car.speed *= 0.5;
          G.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, color: '#ff5a3d', size: 5 });
          dead = true;
          break;
        }
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
}
