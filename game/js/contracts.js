// Santa Brisa Rush — contracts: five story missions for Nico Reyes plus the
// taxi side work. Carmen Ortiz ("La Jefa") calls the shots; Dario Voss is the
// man you are taking the city back from. Each contract pays cash on delivery.

import { dist } from './rng.js';
import { raiseHeat } from './heat.js';

export const CONTRACTS = [
  {
    name: 'Meter Running',
    briefing: 'CARMEN: Nico, you need wheels and a rep. There is a fare waiting at the Boardwalk. Pick them up, drop them at the Marina, and do not scratch the paint.',
    steps: [
      { text: 'Pick up the fare at the Boardwalk', target: { x: 1520, y: 2290 }, kind: 'pickup' },
      { text: 'Drop the fare at the Marina', target: { x: 3050, y: 1150 }, kind: 'drop' },
    ],
    reward: 120,
  },
  {
    name: 'Special Delivery',
    briefing: 'CARMEN: A package for a friend in the Barrio. No questions, no stops. Dario has patrols on the avenues, so keep it smooth.',
    steps: [
      { text: 'Collect the package in Downtown', target: { x: 2120, y: 1320 }, kind: 'pickup' },
      { text: 'Deliver it to the Barrio', target: { x: 560, y: 1320 }, kind: 'drop' },
    ],
    reward: 260,
  },
  {
    name: 'Borrowed Wheels',
    briefing: 'CARMEN: Dario parks his crimson sportscar at Casino Row every night like he owns the place. Tonight it is ours. Take it and bring it to the garage in the Barrio.',
    steps: [
      { text: 'Steal the crimson sportscar at Casino Row', target: { x: 1820, y: 320 }, kind: 'steal' },
      { text: 'Bring it to the garage in the Barrio', target: { x: 560, y: 1820 }, kind: 'drop' },
    ],
    reward: 520,
  },
  {
    name: 'Blue Lights',
    briefing: 'CARMEN: The department is all over you, Nico. Three stars and roadblocks on the avenues. Lose them — get to the Boardwalk and stay out of sight.',
    steps: [
      { text: 'Escape the police — reach the Boardwalk', target: { x: 1520, y: 2400 }, kind: 'escape' },
    ],
    reward: 400,
  },
  {
    name: 'Payday at the Marina',
    briefing: 'CARMEN: This is the big one. Dario\'s money boat leaves the Marina at dawn. Take the cash, lose the whole department, and meet me at the pier. Santa Brisa is ours after tonight.',
    steps: [
      { text: 'Grab the cash at the Marina docks', target: { x: 3200, y: 1000 }, kind: 'pickup' },
      { text: 'Escape to the pier at the Boardwalk', target: { x: 2720, y: 2420 }, kind: 'escape' },
    ],
    reward: 1200,
  },
];

export function startContract(G, idx) {
  const def = CONTRACTS[idx];
  if (!def) return false;
  G.mission = {
    idx,
    def,
    step: 0,
    active: true,
    text: def.briefing,
    target: def.steps[0].target,
    kind: def.steps[0].kind,
    timer: 0,
  };
  G.audio.jingle();
  return true;
}

export function finishContract(G) {
  const m = G.mission;
  if (!m) return;
  G.player.cash += m.def.reward;
  G.stats.missionsDone += 1;
  G.audio.paid();
  G.mode = 'contractDone';
  G.modeTimer = 3.2;
  G.missionDoneText = `CONTRACT COMPLETE: ${m.def.name} — $${m.def.reward}`;
  G.mission = null;
  if (G.stats.missionsDone >= CONTRACTS.length) {
    G.mode = 'finale';
    G.modeTimer = 5;
  }
}

export function updateContracts(G, dt) {
  const m = G.mission;
  if (!m || !m.active) return;
  m.timer += dt;
  const p = G.player;
  const d = dist(p.x, p.y, m.target.x, m.target.y);
  if (m.kind === 'escape') {
    if (d < 130 && p.wanted === 0) {
      finishContract(G);
    }
    return;
  }
  if (d > 110) return;
  if (m.kind === 'steal') {
    if (!p.car) return;
    if (p.car.model !== 'sport' || p.car.color !== '#e84c4c') {
      m.text = 'That is not the crimson sportscar. Find the red sportscar at Casino Row.';
      return;
    }
  }
  if (m.kind === 'pickup') {
    G.audio.pickup();
  }
  m.step += 1;
  if (m.step >= m.def.steps.length) {
    finishContract(G);
    return;
  }
  const next = m.def.steps[m.step];
  m.target = next.target;
  m.kind = next.kind;
  m.text = next.text;
}

export function startTaxiJob(G) {
  if (G.taxi.active || G.mission) return false;
  const spots = [
    { x: 920, y: 820 }, { x: 2120, y: 1820 }, { x: 2720, y: 320 },
    { x: 1520, y: 1320 }, { x: 560, y: 820 }, { x: 3050, y: 1820 },
  ];
  const dests = [
    { x: 3050, y: 1150, name: 'the Marina' },
    { x: 1520, y: 2400, name: 'the Boardwalk' },
    { x: 1820, y: 320, name: 'Casino Row' },
    { x: 560, y: 1320, name: 'the Barrio' },
  ];
  const spot = spots[G.rng.int(0, spots.length - 1)];
  const dest = dests[G.rng.int(0, dests.length - 1)];
  G.taxi = {
    active: true,
    phase: 'toPickup',
    pickup: spot,
    dest,
    fare: 40 + Math.round(dist(spot.x, spot.y, dest.x, dest.y) / 60),
    timer: 0,
  };
  G.audio.jingle();
  return true;
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t.active) return;
  t.timer += dt;
  const p = G.player;
  const target = t.phase === 'toPickup' ? t.pickup : t.dest;
  if (dist(p.x, p.y, target.x, target.y) > 110) return;
  if (!p.car) return;
  if (t.phase === 'toPickup') {
    t.phase = 'toDrop';
    G.audio.pickup();
    return;
  }
  G.player.cash += t.fare;
  G.stats.faresDone += 1;
  G.audio.paid();
  G.taxi = { active: false, phase: null, pickup: null, dest: null, fare: 0, timer: 0 };
}

export function currentObjective(G) {
  if (G.mission) {
    const m = G.mission;
    const step = m.def.steps[m.step];
    return `${m.def.name}: ${step ? step.text : ''}`;
  }
  if (G.taxi.active) {
    return G.taxi.phase === 'toPickup'
      ? `Taxi: pick up the fare`
      : `Taxi: drop the fare at ${G.taxi.dest.name} — $${G.taxi.fare}`;
  }
  return 'Press N for a taxi job, or talk to Carmen (Missions start automatically)';
}
