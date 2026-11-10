// A small football match for the UK guide's top bar in the browser version: the wide TV camera in
// the main stand, panning to follow the ball. Two generic teams (EPG in red, OG in sky blue) pass,
// dribble, press and shoot; keepers save, goals go in, and play restarts from kick-off. A TV-style
// score box keeps the score and the clock.
//
// The camera only turns, so the pitch and stands are drawn once as a wide panorama (a cylindrical
// projection, where turning the camera just slides the picture) and the players are drawn on top
// each frame. No real clubs, badges or kits.

const HALF = 52.5; // half the pitch length, metres
const WIDTH = 68; // pitch width; the near touchline is z = 0
const GOAL_HALF = 3.66;
const GOAL_H = 2.44;
const GOAL_D = 2;

// The camera, high in the main stand on the halfway line.
const CAM_H = 10;
const CAM_BACK = 40; // in front of the near touchline
const SCENE_WIDTH = 1074; // the bar width the view is framed for; wider bars just see more
const FOV = 50; // degrees across a SCENE_WIDTH bar
const SQUASH = 0.2; // how deep the pitch looks, so it fits a bar this short
const LIFT = 0.45; // how tall anything standing on the pitch looks
const HORIZON = 0;
const YAW_MAX = (22 * Math.PI) / 180; // how far the camera pans either way
const STEP = 1 / 30; // simulation step, seconds

const KITS = [
  { shirt: '#d7262b', shorts: '#f4f4f4', socks: '#d7262b', keeper: '#f2d21b', keeperShorts: '#1b1d22', name: 'EPG' },
  { shirt: '#6cb4ee', shorts: '#1b2a4a', socks: '#6cb4ee', keeper: '#2fbf71', keeperShorts: '#14351f', name: 'OG' },
];
const SKIN = ['#f1c9a5', '#e0ac7e', '#c68a5b', '#8d5a3b', '#5c3a24'];
const HAIR = ['#1d1612', '#3a2a1c', '#6b4a2a', '#c9a35a', '#121212'];

function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

type Pt = { x: number; z: number };

// --- Projection -------------------------------------------------------------------------------

type View = { f: number; at: (x: number, h: number, z: number) => { a: number; d: number; y: number } };

function view(): View {
  const f = SCENE_WIDTH / ((FOV * Math.PI) / 180);
  return {
    f,
    at: (x, h, z) => {
      const dz = z + CAM_BACK;
      const d = Math.hypot(x, dz);
      return { a: Math.atan2(x, dz), d, y: HORIZON + (f * SQUASH * CAM_H) / d - (f * LIFT * h) / d };
    },
  };
}

function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], fill: string) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// --- The ground, stands and goals, drawn once ------------------------------------------------

function drawPanorama(ctx: CanvasRenderingContext2D, v: View, panoWidth: number, height: number) {
  const X = (a: number) => panoWidth / 2 + v.f * a;
  const P = (x: number, h: number, z: number): [number, number] => {
    const q = v.at(x, h, z);
    return [X(q.a), q.y];
  };
  // A ground-level outline through (x, z) points, sampled so straight lines curve correctly.
  const along = (from: Pt, to: Pt, h = 0, steps = 10) => Array.from({ length: steps + 1 }, (_, i) => P(from.x + ((to.x - from.x) * i) / steps, h, from.z + ((to.z - from.z) * i) / steps));
  const quad = (x0: number, z0: number, x1: number, z1: number, fill: string) =>
    poly(ctx, [...along({ x: x0, z: z0 }, { x: x1, z: z0 }), ...along({ x: x1, z: z0 }, { x: x1, z: z1 }), ...along({ x: x1, z: z1 }, { x: x0, z: z1 }), ...along({ x: x0, z: z1 }, { x: x0, z: z0 })], fill);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#1a1d22');
  sky.addColorStop(1, '#23272e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, panoWidth, height);

  // Stands: the long one across the pitch, and one behind each goal, packed with fans.
  const rand = seeded(9);
  const shirts = ['#d7262b', '#6cb4ee', '#f4f4f4', '#d7262b', '#6cb4ee', '#1b2a4a', '#f2d21b', '#9a9da3', '#5c6068', '#c7c9ce'];
  const stand = (corner: (u: number, w: number) => [number, number, number], steps: number) => {
    for (let i = 0; i < steps; i++) {
      const w0 = i / steps;
      const w1 = (i + 1) / steps;
      const q = [corner(0, w0), corner(0, w1), corner(1, w1), corner(1, w0)].map(([x, h, z]) => P(x, h, z));
      poly(ctx, q, '#2b2f37');
      const area = Math.abs(q.reduce((t, p, k) => t + p[0] * q[(k + 1) % 4][1] - q[(k + 1) % 4][0] * p[1], 0)) / 2;
      const n = Math.min(2400, Math.round(area / 2));
      ctx.globalAlpha = 0.72;
      for (let k = 0; k < n; k++) {
        const [x, h, z] = corner(rand(), w0 + (w1 - w0) * rand());
        const q2 = v.at(x, h, z);
        const s = Math.min(1.6, Math.max(0.7, 230 / q2.d));
        ctx.fillStyle = shirts[Math.floor(rand() * shirts.length)];
        ctx.fillRect(X(q2.a), q2.y - s, s, s * 1.2);
      }
      ctx.globalAlpha = 1;
    }
  };
  stand((u, w) => [-75 + 150 * w, 1 + u * 24, WIDTH + 7 + u * 34], 40);
  for (const side of [-1, 1]) stand((u, w) => [side * (HALF + 9 + u * 32), 1 + u * 22, -12 + 92 * w], 20);

  // Grass beyond the lines, then the mowing stripes on the pitch.
  quad(-HALF - 12, -24, HALF + 12, WIDTH + 4, '#2a5c2f');
  for (let i = 0; i < 20; i++) quad(-HALF + i * 5.25, 0, -HALF + (i + 1) * 5.25, WIDTH, i % 2 ? '#2d6533' : '#33703a');

  // Advertising boards along the far touchline.
  const boardZ = WIDTH + 3;
  poly(ctx, [...along({ x: -HALF - 6, z: boardZ }, { x: HALF + 6, z: boardZ }, 0, 40), ...along({ x: HALF + 6, z: boardZ }, { x: -HALF - 6, z: boardZ }, 0.9, 40)], '#141a2c');
  const words = ['EPG OG', 'FREE TV GUIDE', 'EPG OG', 'NO ADS · NO SIGN-UP'];
  const colours = ['#ff4d4d', '#f4f4f4', '#6cb4ee', '#f2d21b'];
  for (let i = 0, x = -HALF - 2; x < HALF; i++, x += 14) {
    const q = v.at(x + 6, 0.45, boardZ);
    const size = (v.f * LIFT * 0.62) / q.d;
    ctx.font = `800 ${size.toFixed(1)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colours[i % colours.length];
    ctx.fillText(words[i % words.length], X(q.a), q.y);
  }

  // Pitch markings.
  const lineWidth = (z: number) => Math.max(0.6, 55 / v.at(0, 0, z).d);
  const stroke = (pts: [number, number][], z: number) => {
    ctx.strokeStyle = 'rgba(245,247,250,.85)';
    ctx.lineWidth = lineWidth(z);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  const line = (x0: number, z0: number, x1: number, z1: number) => stroke(along({ x: x0, z: z0 }, { x: x1, z: z1 }, 0, 24), (z0 + z1) / 2);
  const arc = (cx: number, cz: number, r: number, a0: number, a1: number) =>
    stroke(Array.from({ length: 33 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / 32; return P(cx + r * Math.cos(a), 0, cz + r * Math.sin(a)); }), cz);
  line(-HALF, 0, HALF, 0);
  line(-HALF, WIDTH, HALF, WIDTH);
  line(-HALF, 0, -HALF, WIDTH);
  line(HALF, 0, HALF, WIDTH);
  line(0, 0, 0, WIDTH);
  arc(0, WIDTH / 2, 9.15, 0, Math.PI * 2);
  for (const s of [-1, 1]) {
    const g = s * HALF;
    line(g, 13.84, g - s * 16.5, 13.84);
    line(g - s * 16.5, 13.84, g - s * 16.5, 54.16);
    line(g - s * 16.5, 54.16, g, 54.16);
    line(g, 24.84, g - s * 5.5, 24.84);
    line(g - s * 5.5, 24.84, g - s * 5.5, 43.16);
    line(g - s * 5.5, 43.16, g, 43.16);
    const spot = g - s * 11;
    const a = Math.acos(5.5 / 9.15);
    arc(spot, 34, 9.15, s > 0 ? Math.PI - a : -a, s > 0 ? Math.PI + a : a);
    const [sx, sy] = P(spot, 0, 34);
    ctx.fillStyle = 'rgba(245,247,250,.85)';
    ctx.fillRect(sx - 1, sy - 0.5, 2, 1);
    for (const cz of [0, WIDTH]) arc(g, cz, 1, 0, Math.PI * 2);
  }
  const [cx, cy] = P(0, 0, 34);
  ctx.fillRect(cx - 1, cy - 0.5, 2, 1);

  // Goals: the net, then the white frame in front of it.
  for (const s of [-1, 1]) {
    const g = s * HALF;
    const back = g + s * GOAL_D;
    ctx.strokeStyle = 'rgba(230,234,240,.35)';
    ctx.lineWidth = 0.5;
    for (let k = 0; k <= 8; k++) {
      const z = 34 - GOAL_HALF + (2 * GOAL_HALF * k) / 8;
      const a = P(back, 0, z);
      const b = P(back, GOAL_H * 0.8, z);
      const c = P(g, GOAL_H, z);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
    }
    for (let k = 0; k <= 3; k++) {
      const h = (GOAL_H * 0.8 * k) / 3;
      stroke([P(back, h, 34 - GOAL_HALF), P(back, h, 34 + GOAL_HALF)], 34);
    }
    ctx.strokeStyle = '#f7f8fa';
    ctx.lineWidth = Math.max(1, lineWidth(34) * 1.4);
    const frame = [P(g, 0, 34 - GOAL_HALF), P(g, GOAL_H, 34 - GOAL_HALF), P(g, GOAL_H, 34 + GOAL_HALF), P(g, 0, 34 + GOAL_HALF)];
    ctx.beginPath();
    frame.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}

// --- The match ---------------------------------------------------------------------------------

type Player = { team: 0 | 1; keeper: boolean; baseU: number; baseV: number; x: number; z: number; vx: number; vz: number; stride: number; face: number; skin: string; hair: string };
type Flight = { x0: number; z0: number; x1: number; z1: number; h1: number; t0: number; dur: number; peak: number };
type Phase = 'kickoff' | 'dribble' | 'pass' | 'shot' | 'goal' | 'held';

type Match = {
  t: number;
  rand: () => number;
  players: Player[];
  ref: { x: number; z: number; vx: number; vz: number; stride: number; face: number };
  ball: { x: number; z: number; h: number };
  phase: Phase;
  phaseEnd: number;
  owner: number; // player on the ball, or -1
  receiver: number;
  flight: Flight | null;
  goalBound: boolean;
  dribble: Pt;
  score: [number, number];
  scorer: number;
  kickoffTeam: 0 | 1;
  lastGoalAt: number;
  yaw: number;
};

const FORMATION: [number, number][] = [
  [2, 34],
  [17, 10], [15, 26], [15, 42], [17, 58],
  [34, 8], [32, 26], [32, 42], [34, 60],
  [48, 27], [48, 41],
];

const dir = (team: number) => (team === 0 ? 1 : -1);
const toX = (team: number, u: number) => (team === 0 ? u - HALF : HALF - u);
const toZ = (team: number, v: number) => (team === 0 ? v : WIDTH - v);
const goalX = (team: number) => dir(team) * HALF; // the goal a team attacks

function newMatch(): Match {
  const rand = seeded(2024);
  const players: Player[] = [];
  for (const team of [0, 1] as const)
    FORMATION.forEach(([u, v], i) => {
      const x = toX(team, u);
      const z = toZ(team, v);
      players.push({ team, keeper: i === 0, baseU: u, baseV: v, x, z, vx: 0, vz: 0, stride: rand() * 6, face: 1, skin: SKIN[Math.floor(rand() * SKIN.length)], hair: HAIR[Math.floor(rand() * HAIR.length)] });
    });
  const m: Match = {
    t: 0, rand, players, ref: { x: -6, z: 20, vx: 0, vz: 0, stride: 0, face: 1 }, ball: { x: 0, z: 34, h: 0 },
    phase: 'kickoff', phaseEnd: 1.2, owner: -1, receiver: -1, flight: null, goalBound: false, dribble: { x: 1, z: 0 },
    score: [0, 0], scorer: -1, kickoffTeam: 0, lastGoalAt: -99, yaw: 0,
  };
  setKickoff(m, 0);
  return m;
}

function setKickoff(m: Match, team: 0 | 1) {
  m.kickoffTeam = team;
  m.ball = { x: 0, z: 34, h: 0 };
  m.owner = team * 11 + 9; // a striker takes it
  m.flight = null;
  m.phase = 'kickoff';
}

const teammates = (m: Match, team: number) => m.players.map((p, i) => [p, i] as const).filter(([p]) => p.team === team);

function launch(m: Match, to: Pt, speed: number, peak: number, h1 = 0) {
  const dist = Math.hypot(to.x - m.ball.x, to.z - m.ball.z);
  m.flight = { x0: m.ball.x, z0: m.ball.z, x1: to.x, z1: to.z, h1, t0: m.t, dur: Math.max(0.25, dist / speed), peak };
}

function pass(m: Match, from: number, long = false) {
  const carrier = m.players[from];
  const options = teammates(m, carrier.team).filter(([p, i]) => i !== from && !p.keeper);
  let best = options[0];
  let bestScore = -1e9;
  for (const option of options) {
    const [p] = option;
    const dist = Math.hypot(p.x - carrier.x, p.z - carrier.z);
    const ahead = dir(carrier.team) * (p.x - carrier.x);
    const s = (long ? ahead * 0.7 : ahead * 0.6) - Math.abs(dist - (long ? 32 : 17)) * 0.45 + m.rand() * 9;
    if (s > bestScore) [bestScore, best] = [s, option];
  }
  const [target, index] = best;
  // Aim slightly ahead of where the receiver is running.
  let to = { x: target.x + target.vx * 0.5, z: Math.min(WIDTH - 2, Math.max(2, target.z + target.vz * 0.5)) };
  let receiver = index;
  const dist = Math.hypot(to.x - m.ball.x, to.z - m.ball.z);
  const lofted = long || dist > 28;
  // An opponent near the line of the pass may cut it out.
  if (!lofted) {
    for (const [opp, oi] of teammates(m, 1 - carrier.team)) {
      const dx = to.x - m.ball.x;
      const dz = to.z - m.ball.z;
      const k = Math.max(0, Math.min(1, ((opp.x - m.ball.x) * dx + (opp.z - m.ball.z) * dz) / (dx * dx + dz * dz)));
      const px = m.ball.x + dx * k;
      const pz = m.ball.z + dz * k;
      if (Math.hypot(opp.x - px, opp.z - pz) < 2.2 && k > 0.15 && m.rand() < 0.5) {
        to = { x: px, z: pz };
        receiver = oi;
        break;
      }
    }
  }
  launch(m, to, lofted ? 21 : 18, lofted ? Math.min(10, dist * 0.2) : 0);
  m.receiver = receiver;
  m.owner = -1;
  m.phase = 'pass';
}

function shoot(m: Match, from: number) {
  const shooter = m.players[from];
  const gx = goalX(shooter.team);
  const z = 34 + (m.rand() - 0.5) * 2 * (GOAL_HALF - 0.4);
  const h = 0.2 + m.rand() * 1.9;
  m.goalBound = m.rand() < 0.34;
  launch(m, { x: gx, z }, 27, h > 1.2 ? 1.2 : 0.4, h);
  m.scorer = from;
  m.receiver = shooter.team === 0 ? 11 : 0; // the other keeper
  m.owner = -1;
  m.phase = 'shot';
}

function step(m: Match, dt: number) {
  m.t += dt;
  const P = m.players;

  // What happens next.
  if (m.phase === 'kickoff') {
    const settled = P.every((p, i) => i === m.owner || Math.hypot(p.x - toX(p.team, Math.min(p.baseU, 50)), p.z - toZ(p.team, p.baseV)) < 3);
    if ((settled && m.t > m.phaseEnd) || m.t > m.phaseEnd + 5) pass(m, m.owner);
  } else if (m.phase === 'dribble' && m.owner >= 0) {
    const c = P[m.owner];
    // A defender close enough may win it.
    for (const [opp, oi] of teammates(m, 1 - c.team))
      if (!opp.keeper && Math.hypot(opp.x - c.x, opp.z - c.z) < 1.3 && m.rand() < dt * 1.6) {
        m.owner = oi;
        m.dribble = { x: dir(opp.team), z: 0 };
        m.phaseEnd = m.t + 0.6 + m.rand();
        break;
      }
    if (m.t > m.phaseEnd) {
      const c2 = P[m.owner];
      const toGoal = Math.hypot(goalX(c2.team) - c2.x, 34 - c2.z);
      // Close in, always shoot; from the edge of the box, sometimes have a go.
      if (!c2.keeper && (toGoal < 21 || (toGoal < 32 && m.rand() < 0.55))) shoot(m, m.owner);
      else pass(m, m.owner);
    }
  } else if ((m.phase === 'pass' || m.phase === 'shot') && m.flight && m.t >= m.flight.t0 + m.flight.dur) {
    if (m.phase === 'shot' && m.goalBound) {
      const team = P[m.scorer].team;
      m.score[team]++;
      m.lastGoalAt = m.t;
      m.phase = 'goal';
      m.phaseEnd = m.t + 4.5;
      m.ball = { x: goalX(team) + dir(team) * 1.6, z: m.flight.z1, h: 0.3 };
      m.flight = null;
    } else {
      m.owner = m.receiver;
      m.flight = null;
      if (m.phase === 'shot') {
        m.phase = 'held';
        m.phaseEnd = m.t + 1.4;
      } else {
        m.phase = 'dribble';
        m.dribble = { x: dir(P[m.owner].team), z: (34 - P[m.owner].z) * 0.025 + (m.rand() - 0.5) * 0.7 };
        m.phaseEnd = m.t + 0.7 + m.rand() * 1.6;
      }
    }
  } else if (m.phase === 'held' && m.t > m.phaseEnd) {
    pass(m, m.owner, true);
  } else if (m.phase === 'goal' && m.t > m.phaseEnd) {
    setKickoff(m, (1 - P[m.scorer].team) as 0 | 1);
    m.phaseEnd = m.t + 1;
  }

  // Ball.
  if (m.flight) {
    const f = m.flight;
    const k = Math.min(1, (m.t - f.t0) / f.dur);
    m.ball = { x: f.x0 + (f.x1 - f.x0) * k, z: f.z0 + (f.z1 - f.z0) * k, h: f.h1 * k + 4 * f.peak * k * (1 - k) };
  } else if (m.owner >= 0) {
    const c = P[m.owner];
    const speed = Math.hypot(c.vx, c.vz);
    const fx = speed > 0.5 ? c.vx / speed : dir(c.team);
    const fz = speed > 0.5 ? c.vz / speed : 0;
    m.ball = { x: c.x + fx * 0.7, z: c.z + fz * 0.7, h: c.keeper && m.phase === 'held' ? 1.1 : 0 };
  }

  // Where everyone wants to be.
  const ballU = (team: number) => (team === 0 ? m.ball.x + HALF : HALF - m.ball.x);
  const attacking = m.owner >= 0 ? P[m.owner].team : m.receiver >= 0 && m.phase === 'pass' ? P[m.receiver].team : -1;
  const presser = [0, 1].map((team) => {
    let best = -1;
    let bestD = 1e9;
    for (const [p, i] of teammates(m, team)) {
      if (p.keeper) continue;
      const d = Math.hypot(p.x - m.ball.x, p.z - m.ball.z);
      if (d < bestD) [bestD, best] = [d, i];
    }
    return best;
  });
  P.forEach((p, i) => {
    let tx: number;
    let tz: number;
    let speed = 6.5;
    if (m.phase === 'kickoff' || (m.phase === 'goal' && m.t > m.lastGoalAt + 2.2)) {
      tx = toX(p.team, Math.min(p.baseU, 50));
      tz = toZ(p.team, p.baseV);
      speed = 5;
      if (i === m.owner) [tx, tz] = [m.ball.x - dir(p.team) * 0.6, 34];
    } else if (m.phase === 'goal') {
      const scorer = P[m.scorer];
      if (i === m.scorer) [tx, tz, speed] = [goalX(p.team) * 0.92, scorer.z < 34 ? 2 : WIDTH - 2, 7.5];
      else if (p.team === scorer.team && !p.keeper) [tx, tz, speed] = [scorer.x, scorer.z, 6];
      else [tx, tz, speed] = [p.x, p.z, 0];
    } else if (i === m.owner) {
      tx = p.x + m.dribble.x * 6;
      tz = Math.min(WIDTH - 3, Math.max(3, p.z + m.dribble.z * 6));
      speed = p.keeper ? 0 : 6;
    } else if (i === m.receiver && m.flight) {
      tx = m.flight.x1;
      tz = m.flight.z1;
      speed = p.keeper ? 9 : 7.5;
      // On a shot that's going in, the keeper goes the wrong way or comes up short.
      if (m.phase === 'shot' && m.goalBound) tz += m.flight.z1 > 34 ? -2.8 : 2.8;
    } else if (p.keeper) {
      tx = goalX(1 - p.team) + dir(p.team) * 2.5;
      tz = 34 + (m.ball.z - 34) * 0.15;
    } else if (i === presser[p.team] && attacking !== -1 && attacking !== p.team) {
      tx = m.ball.x;
      tz = m.ball.z;
      speed = 7;
    } else {
      const bu = ballU(p.team);
      const push = attacking === p.team ? 12 : attacking === -1 ? 4 : -3;
      const u = Math.max(p.baseU - 12, Math.min(p.baseU + 42, p.baseU + (bu - 52) * 0.55 + push));
      tx = toX(p.team, Math.min(u, 100));
      tz = toZ(p.team, p.baseV) + (m.ball.z - 34) * 0.35;
    }
    // Steer towards the target, easing in on arrival, and keep a little space from teammates.
    let dx = tx - p.x;
    let dz = tz - p.z;
    for (const q of P) {
      if (q === p || q.team !== p.team) continue;
      const sx = p.x - q.x;
      const sz = p.z - q.z;
      const s2 = sx * sx + sz * sz;
      if (s2 < 9 && s2 > 0.0001) {
        dx += (sx / Math.sqrt(s2)) * 2;
        dz += (sz / Math.sqrt(s2)) * 2;
      }
    }
    const dist = Math.hypot(dx, dz);
    const want = Math.min(speed, dist * 1.4);
    const ux = dist > 0.01 ? (dx / dist) * want : 0;
    const uz = dist > 0.01 ? (dz / dist) * want : 0;
    const k = Math.min(1, dt * 5);
    p.vx += (ux - p.vx) * k;
    p.vz += (uz - p.vz) * k;
    p.x = Math.max(-HALF - 3, Math.min(HALF + 3, p.x + p.vx * dt));
    p.z = Math.max(-1.5, Math.min(WIDTH + 1.5, p.z + p.vz * dt));
    p.stride += Math.hypot(p.vx, p.vz) * dt * 1.9;
    if (Math.abs(p.vx) > 0.3) p.face = Math.sign(p.vx);
  });

  // The referee keeps up with play from a diagonal.
  const r = m.ref;
  const rtx = m.ball.x * 0.8;
  const rtz = Math.min(WIDTH - 4, Math.max(4, m.ball.z + (m.ball.z < 34 ? 12 : -12)));
  const rd = Math.hypot(rtx - r.x, rtz - r.z);
  const rw = Math.min(6, rd * 1.2);
  r.vx += ((rd > 0.01 ? ((rtx - r.x) / rd) * rw : 0) - r.vx) * Math.min(1, dt * 4);
  r.vz += ((rd > 0.01 ? ((rtz - r.z) / rd) * rw : 0) - r.vz) * Math.min(1, dt * 4);
  r.x += r.vx * dt;
  r.z += r.vz * dt;
  r.stride += Math.hypot(r.vx, r.vz) * dt * 1.9;
  if (Math.abs(r.vx) > 0.3) r.face = Math.sign(r.vx);

  // The camera follows the ball.
  const target = Math.max(-YAW_MAX, Math.min(YAW_MAX, Math.atan2(m.ball.x, m.ball.z + CAM_BACK)));
  m.yaw += (target - m.yaw) * Math.min(1, dt * 1.6);
}

// --- Drawing the players ----------------------------------------------------------------------

type Body = { x: number; z: number; stride: number; face: number; moving: number; shirt: string; shorts: string; socks: string; skin: string; hair: string };

function drawPerson(ctx: CanvasRenderingContext2D, v: View, sx: (a: number) => number, b: Body) {
  const q = v.at(b.x, 0, b.z);
  const x = sx(q.a);
  const foot = q.y;
  const H = (v.f * LIFT * 1.8) / q.d;
  const w = H * 0.3;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,.33)';
  ctx.beginPath();
  ctx.ellipse(x + H * 0.08, foot, H * 0.26, Math.max(0.6, H * 0.06), 0, 0, Math.PI * 2);
  ctx.fill();
  const swing = Math.sin(b.stride) * Math.min(1, b.moving / 2);
  const hip = foot - H * 0.47;
  ctx.lineCap = 'round';
  // Legs: socks below the knee, shorts at the top.
  for (const side of [-1, 1]) {
    const fx = x + side * w * 0.18 + side * swing * H * 0.13 * b.face;
    ctx.strokeStyle = b.skin;
    ctx.lineWidth = Math.max(1, H * 0.085);
    ctx.beginPath();
    ctx.moveTo(x + side * w * 0.2, hip);
    ctx.lineTo(fx, foot - H * 0.04);
    ctx.stroke();
    ctx.strokeStyle = b.socks;
    ctx.beginPath();
    ctx.moveTo(x + side * w * 0.2 + (fx - x - side * w * 0.2) * 0.55, hip + (foot - H * 0.04 - hip) * 0.55);
    ctx.lineTo(fx, foot - H * 0.04);
    ctx.stroke();
  }
  // Shorts and shirt.
  ctx.fillStyle = b.shorts;
  ctx.fillRect(x - w * 0.5, hip - H * 0.02, w, H * 0.14);
  ctx.fillStyle = b.shirt;
  ctx.beginPath();
  ctx.roundRect(x - w * 0.55, hip - H * 0.35, w * 1.1, H * 0.36, H * 0.05);
  ctx.fill();
  // Arms swinging against the legs.
  if (H > 7) {
    for (const side of [-1, 1]) {
      ctx.strokeStyle = b.skin;
      ctx.lineWidth = Math.max(0.8, H * 0.06);
      const sx2 = x + side * w * 0.55;
      const sy2 = hip - H * 0.3;
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.lineTo(sx2 + side * H * 0.03 - side * swing * H * 0.1 * b.face, sy2 + H * 0.26);
      ctx.stroke();
      ctx.strokeStyle = b.shirt;
      ctx.lineWidth = Math.max(0.9, H * 0.075);
      ctx.beginPath();
      ctx.moveTo(sx2, sy2);
      ctx.lineTo(sx2 - side * swing * H * 0.04 * b.face, sy2 + H * 0.1);
      ctx.stroke();
    }
  }
  // Head and hair.
  const headY = hip - H * 0.44;
  ctx.fillStyle = b.skin;
  ctx.beginPath();
  ctx.arc(x, headY, Math.max(0.9, H * 0.075), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = b.hair;
  ctx.beginPath();
  ctx.arc(x, headY - H * 0.015, Math.max(0.9, H * 0.075), Math.PI, Math.PI * 2);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, v: View, sx: (a: number) => number, ball: { x: number; z: number; h: number }) {
  const ground = v.at(ball.x, 0, ball.z);
  const up = v.at(ball.x, ball.h + 0.11, ball.z);
  const r = Math.max(1.1, (v.f * LIFT * 0.24) / ground.d);
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(sx(ground.a), ground.y, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sx(up.a), up.y - r * 0.4, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,20,.55)';
  ctx.beginPath();
  ctx.arc(sx(up.a) + r * 0.2, up.y - r * 0.5, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// A TV-style score box with the match clock.
function drawScore(ctx: CanvasRenderingContext2D, m: Match, clock: number) {
  const mins = Math.floor(clock / 60) % 90;
  const secs = Math.floor(clock % 60);
  const flash = m.t - m.lastGoalAt < 2.5 && Math.floor((m.t - m.lastGoalAt) * 4) % 2 === 0;
  ctx.font = '700 10px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const x = 22;
  const y = 6;
  ctx.fillStyle = 'rgba(12,14,18,.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, 146, 15, 4);
  ctx.fill();
  ctx.fillStyle = KITS[0].shirt;
  ctx.fillRect(x + 3, y + 3, 3, 9);
  ctx.fillStyle = KITS[1].shirt;
  ctx.fillRect(x + 78, y + 3, 3, 9);
  ctx.fillStyle = '#f2f3f5';
  ctx.fillText(KITS[0].name, x + 20, y + 8);
  ctx.fillText(KITS[1].name, x + 92, y + 8);
  ctx.fillStyle = flash ? '#f2d21b' : '#ffffff';
  ctx.fillRect(x + 37, y + 2, 34, 11);
  ctx.fillStyle = '#0c0e12';
  ctx.fillText(`${m.score[0]} - ${m.score[1]}`, x + 54, y + 8);
  ctx.fillStyle = '#a3a7ae';
  ctx.fillText(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, x + 126, y + 8);
}

/**
 * Starts the match on `canvas` (sized `width` × `height` CSS px). With `stillAt`, draws just that
 * moment (seconds in) and stops. Returns a function that stops it.
 */
export function startMatch(canvas: HTMLCanvasElement, width: number, height: number, stillAt?: number) {
  const still = stillAt !== undefined;
  if (width < 1 || height < 1) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const v = view();

  // The panorama covers everywhere the camera can turn to, plus the bar's own width.
  const halfView = width / 2 / v.f;
  const panoWidth = Math.ceil(2 * v.f * (YAW_MAX + halfView + 0.03));
  const pano = document.createElement('canvas');
  pano.width = Math.round(panoWidth * dpr);
  pano.height = canvas.height;
  const pctx = pano.getContext('2d')!;
  pctx.scale(dpr, dpr);
  drawPanorama(pctx, v, panoWidth, height);

  const m = newMatch();
  let spare = 0;
  const advance = (seconds: number) => {
    spare += seconds;
    while (spare >= STEP) {
      step(m, STEP);
      spare -= STEP;
    }
  };

  const draw = (clock: number) => {
    const left = panoWidth / 2 + v.f * m.yaw - width / 2;
    const sx = (a: number) => panoWidth / 2 + v.f * a - left;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pano, Math.round(left * dpr), 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const people: { d: number; draw: () => void }[] = m.players.map((p) => {
      const kit = KITS[p.team];
      return {
        d: v.at(p.x, 0, p.z).d,
        draw: () => drawPerson(ctx, v, sx, { x: p.x, z: p.z, stride: p.stride, face: p.face, moving: Math.hypot(p.vx, p.vz), shirt: p.keeper ? kit.keeper : kit.shirt, shorts: p.keeper ? kit.keeperShorts : kit.shorts, socks: p.keeper ? kit.keeper : kit.socks, skin: p.skin, hair: p.hair }),
      };
    });
    const r = m.ref;
    people.push({ d: v.at(r.x, 0, r.z).d, draw: () => drawPerson(ctx, v, sx, { x: r.x, z: r.z, stride: r.stride, face: r.face, moving: Math.hypot(r.vx, r.vz), shirt: '#16181c', shorts: '#16181c', socks: '#16181c', skin: SKIN[1], hair: HAIR[0] }) });
    people.push({ d: v.at(m.ball.x, 0, m.ball.z).d - 0.3, draw: () => drawBall(ctx, v, sx, m.ball) });
    people.sort((a, b) => b.d - a.d).forEach((p) => p.draw());
    drawScore(ctx, m, clock);
  };

  let frame = 0;
  if (still) {
    advance(stillAt);
    draw(stillAt);
    return () => {};
  }
  const start = performance.now();
  let last = start;
  const render = (now: number) => {
    frame = requestAnimationFrame(render);
    // Pause while the guide it's in is hidden (the other country's tab).
    if (!canvas.offsetParent) {
      last = now;
      return;
    }
    advance(Math.min(0.1, (now - last) / 1000));
    last = now;
    draw(m.t);
  };
  frame = requestAnimationFrame(render);
  return () => cancelAnimationFrame(frame);
}
