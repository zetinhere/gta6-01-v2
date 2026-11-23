// missions.js — the Solmara Heat campaign: five story missions with briefings,
// dialogue and objectives, plus free-roam taxi fares and deliveries between
// jobs. Missions are data; the runner below drives them.
import { dist } from './util.js';

export const CAMPAIGN = [
  {
    id: 'first-fare', title: 'First Fare', reward: 150,
    brief: [
      ['ROSA', 'Dana! You are late. My best cab is sitting outside the hotel — take it.'],
      ['ROSA', 'First job: pick up my cousin at the Old Market and drop her at the Pier.'],
      ['DANA', 'One fare. Easy money. I am on it.'],
    ],
    objectives: [
      { text: 'Get in the cab at Hotel Solmara', at: 'hotel', need: 'car' },
      { text: 'Pick up the passenger at the Old Market', at: 'market', need: 'reach' },
      { text: 'Drop her off at the Pier', at: 'pier', need: 'reach' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 300,
    brief: [
      ['ROSA', 'A client wants a Coupe. The pink one by the Stadium. Bring it to the garage.'],
      ['DANA', 'Stealing it? In daylight?'],
      ['ROSA', 'Borrowing. With feeling. The cops will notice — drive like you mean it.'],
    ],
    objectives: [
      { text: 'Steal the pink Coupe at the Stadium', at: 'stadium', need: 'steal' },
      { text: 'Deliver it to the garage — stay ahead of the cops', at: 'garage', need: 'reach' },
    ],
  },
  {
    id: 'beach-run', title: 'Beach Run', reward: 400,
    brief: [
      ['ROSA', 'Sunset cruise, but make it a race. Four checkpoints down Ocean Drive.'],
      ['ROSA', 'Ninety seconds. The whole beach will watch. Do not scratch the paint.'],
      ['DANA', 'Ninety seconds? I will do it in sixty.'],
    ],
    objectives: [
      { text: 'Hit checkpoint 1 — Pier', at: 'pier', need: 'reach', time: 90 },
      { text: 'Hit checkpoint 2 — Beach', at: 'beach', need: 'reach' },
      { text: 'Hit checkpoint 3 — Marina', at: 'marina', need: 'reach' },
      { text: 'Hit checkpoint 4 — Safehouse', at: 'safehouse', need: 'reach' },
    ],
  },
  {
    id: 'the-drop', title: 'The Drop', reward: 600,
    brief: [
      ['ROSA', 'A package at the Old Market. Walk it to the Marina. No car — too loud.'],
      ['ROSA', 'Patrols are out tonight. Keep your head down and your hands empty.'],
      ['DANA', 'On foot, through the whole town. Fine. I walk fast.'],
    ],
    objectives: [
      { text: 'Pick up the package at the Old Market (on foot)', at: 'market', need: 'pickup' },
      { text: 'Carry it to the Marina — avoid the patrols', at: 'marina', need: 'reach' },
      { text: 'Get to the Safehouse in a car', at: 'safehouse', need: 'car' },
    ],
  },
  {
    id: 'solmara-heat', title: 'Solmara Heat', reward: 1000,
    brief: [
      ['ROSA', 'Last job, Dana. The stadium safe holds a fortune. Grab it and run.'],
      ['ROSA', 'Every cop in Solmara will be on you. Lose them, then come home.'],
      ['DANA', 'Then I am done. One last drive. Let us go.'],
    ],
    objectives: [
      { text: 'Grab the cash at the Stadium', at: 'stadium', need: 'pickup' },
      { text: 'Lose the heat — get your wanted level to zero', at: null, need: 'clean' },
      { text: 'Reach the Safehouse', at: 'safehouse', need: 'reach' },
    ],
  },
];

export class MissionRunner {
  constructor() {
    this.index = 0;        // campaign mission index
    this.step = 0;         // objective index inside the mission
    this.phase = 'idle';   // idle | briefing | active | done | campaignDone
    this.briefLine = 0;
    this.timer = 0;        // mission countdown when an objective sets one
    this.carrying = false; // package / cash in hand
    this.job = null;       // free-roam fare or delivery
  }
  get mission() { return CAMPAIGN[this.index]; }
  get objective() {
    const m = this.mission;
    return m ? m.objectives[this.step] : null;
  }
  startMission(i) {
    this.index = i; this.step = 0; this.phase = 'briefing'; this.briefLine = 0;
    this.timer = 0; this.carrying = false;
  }
  nextBriefLine() {
    this.briefLine++;
    if (this.briefLine >= this.mission.brief.length) this.phase = 'active';
  }
  completeObjective(state) {
    const m = this.mission;
    this.step++;
    if (this.step >= m.objectives.length) {
      state.player.cash += m.reward;
      state.message = m.title + ' complete — ' + '$' + m.reward;
      state.messageT = 3;
      if (this.index + 1 >= CAMPAIGN.length) {
        this.phase = 'campaignDone';
      } else {
        this.index++;
        this.phase = 'idle';
      }
      return true;
    }
    const next = this.objective;
    if (next && next.time) this.timer = next.time;
    return false;
  }
  // Called every frame while a mission is active. Returns the waypoint to draw.
  update(state, dt) {
    const o = this.objective;
    if (!o || this.phase !== 'active') return null;
    if (o.time && this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        state.message = 'Too slow — mission failed. Try again!';
        state.messageT = 3;
        this.startMission(this.index); // restart the same mission
        return null;
      }
    }
    const p = state.player;
    if (o.at) {
      const place = state.world.places[o.at];
      const d = dist(p.x, p.y, place.x, place.y);
      const needCar = o.need === 'car';
      if (needCar && p.mode !== 'car') return place;
      if (o.need === 'pickup' && d < 46) { this.carrying = true; this.completeObjective(state); return null; }
      if (o.need === 'steal') {
        // Stealing: the player must be in a car near the spot.
        if (p.mode === 'car' && d < 60) { state.wanted = Math.max(state.wanted, 1); this.completeObjective(state); return null; }
        return place;
      }
      if (d < 56) { this.completeObjective(state); return null; }
      return place;
    }
    if (o.need === 'clean' && state.wanted === 0) { this.completeObjective(state); }
    return o.at ? state.world.places[o.at] : null;
  }
}

// Free-roam work: a fare marker appears; drive to it, take the passenger,
// deliver them, get paid by distance.
export function spawnFare(world, rng, player) {
  const from = world.places[Object.keys(world.places)[Math.floor(rng.next() * Object.keys(world.places).length)]];
  let to = from;
  while (to === from) to = world.places[Object.keys(world.places)[Math.floor(rng.next() * Object.keys(world.places).length)]];
  return { from, to, pay: 60 + Math.floor(dist(from.x, from.y, to.x, to.y) / 12), picked: false };
}
