// A small 3D scene for the browser version's top bar: a camera in the infield at the exit of a
// banked turn, looking back into it. A pack of stock cars comes out of the distance on the right,
// sweeps round the banking in front of the stands and flies past close by off the left edge, then
// comes back round. Only the turn is ever in view. Drawn on a canvas: the track and stands once
// per size, the cars every frame as shaded 3D boxes. Generic liveries only.

type V3 = [number, number, number];

// The track, in metres. The near turn is centred on the origin; the straights run away from the
// camera (+z) for STRAIGHT metres to the far turn.
const R_IN = 92; // bottom of the banking
const R_OUT = 108; // top of the banking
const APRON = 6;
// Long enough for a 1.5-mile lap, so the pack is gone for about half a minute like a real race.
const STRAIGHT = 893;
const TURN_BANK = 0.42; // tan of the banking angle in the turns (about 23°)
const STRAIGHT_BANK = 0.1;
const BANK_BLEND = 60; // metres of straight over which the banking eases off
const WALL = 1.3;
const LANES = [95.5, 100, 104.5];
// Every lane laps in the same time, so the pack stays together. Each lane surges forwards and
// drops back a few metres over time, so cars trade places side by side; all the cars in a lane
// move together, so they never run into each other.
const LANE_LAP = [1, 1, 1];
const LANE_SURGE = [{ size: 3.2, period: 23, phase: 0 }, { size: 2.6, period: 31, phase: 2.1 }, { size: 3.6, period: 19, phase: 4.2 }];
const SPEED = 82; // m/s along the middle lane

// The camera, on a tower in the infield at the turn exit, zoomed in on the middle of the turn.
const CAM_POS: V3 = [-78, 11, 26];
const CAM_AIM: V3 = [-67.5, 0, -73.5];
const FOV = 70; // degrees across the bar
const SQUASH = 0.8; // vertical scale, so a view this wide fits a bar this short
const HORIZON = 4; // px from the top of the bar

// Cars are built from a stock car's side profile (metres along the car from the middle, height),
// nose at +a, a touch taller than real so they still read in a bar this short.
const EX = 1.15;
const BODY_W = 1.0; // half width of the body
const GLASS_W = 0.72; // half width of the cabin, narrower than the body
// Today's Next Gen shape: a low nose, a long bonnet, a steep windscreen, and a fastback rear window
// running down to a short deck.
const BODY: [number, number][] = ([[2.62, 0.1], [2.7, 0.42], [2.42, 0.66], [0.95, 0.84], [-2.5, 0.93], [-2.6, 0.27]] as [number, number][]).map(([a, h]) => [a, h * EX]);
const GLASS: [number, number][] = ([[0.95, 0.84], [-0.05, 1.24], [-1.0, 1.24], [-2.25, 0.92]] as [number, number][]).map(([a, h]) => [a, h * EX]);
const ROOF = 1.24 * EX;
// Heights of the bonnet and windscreen at `a`, for painting on them.
const hoodAt = (a: number) => (0.66 + ((2.42 - a) / 1.47) * 0.18) * EX;
const screenAt = (a: number) => (0.84 + ((0.95 - a) / 1.0) * 0.4) * EX;
const CAR_L = 5.4;
const CAR_W = 2 * BODY_W;
// Made-up numbers, one per car.
const NUMBERS = [2, 5, 8, 11, 14, 17, 19, 21, 22, 23, 33, 41, 42, 45, 47, 51, 54, 60, 71, 77, 7, 10, 12, 16, 20, 31, 34, 38, 43, 6, 9, 15, 26, 29, 35, 66];

const LIVERIES: [string, string][] = [
  ['#f5d01a', '#e8332a'], ['#e8332a', '#f5d01a'], ['#18b7b0', '#15171b'], ['#f2f2f4', '#2f6fe4'],
  ['#8a4fd8', '#f2f2f4'], ['#2f6fe4', '#f5d01a'], ['#1b1d22', '#7ed957'], ['#ff7a1a', '#15171b'],
  ['#2bb24c', '#f2f2f4'], ['#ef5fa7', '#15171b'], ['#3fa9f5', '#e8332a'], ['#b31b1b', '#f2f2f4'],
  ['#f2f2f4', '#e8332a'], ['#5b2a86', '#f5d01a'], ['#c9a227', '#1b1d22'], ['#0e7c86', '#ff7a1a'],
];

const SUN: V3 = norm([-0.35, 0.85, -0.4]);

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v * k)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

// The track is four sections, in racing order: the near turn (right to left past the camera), the
// left straight away from the camera, the far turn, and the right straight back towards it.
type Spot = { p: V3; t: V3; out: V3; bank: number };

function bankAt(section: number, f: number) {
  if (section === 0 || section === 2) return TURN_BANK;
  const d = Math.min(f, 1 - f) * STRAIGHT;
  const k = Math.max(0, 1 - d / BANK_BLEND);
  return STRAIGHT_BANK + (TURN_BANK - STRAIGHT_BANK) * k * k * (3 - 2 * k);
}

/** A point `r` metres from the turn centres, `f` of the way through `section`, on the banking. */
function spot(section: number, f: number, r: number, height?: number): Spot {
  let x: number, z: number, t: V3, out: V3;
  if (section === 0) {
    const a = f * Math.PI;
    [x, z, t, out] = [r * Math.cos(a), -r * Math.sin(a), [-Math.sin(a), 0, -Math.cos(a)], [Math.cos(a), 0, -Math.sin(a)]];
  } else if (section === 1) {
    [x, z, t, out] = [-r, f * STRAIGHT, [0, 0, 1], [-1, 0, 0]];
  } else if (section === 2) {
    const a = f * Math.PI;
    [x, z, t, out] = [-r * Math.cos(a), STRAIGHT + r * Math.sin(a), [Math.sin(a), 0, Math.cos(a)], [-Math.cos(a), 0, Math.sin(a)]];
  } else {
    [x, z, t, out] = [r, STRAIGHT * (1 - f), [0, 0, -1], [1, 0, 0]];
  }
  const bank = bankAt(section, f);
  const y = height ?? Math.max(0, r - R_IN) * bank;
  return { p: [x, y, z], t, out, bank };
}

/** Where a car `s` metres round its lane is: section and how far through it. */
function laneSpot(r: number, s: number) {
  const turn = Math.PI * r;
  const lap = 2 * turn + 2 * STRAIGHT;
  s = ((s % lap) + lap) % lap;
  const lengths = [turn, STRAIGHT, turn, STRAIGHT];
  for (let i = 0; i < 4; i++) {
    if (s < lengths[i]) return spot(i, s / lengths[i], r);
    s -= lengths[i];
  }
  return spot(0, 0, r);
}
const lapLength = (r: number) => 2 * Math.PI * r + 2 * STRAIGHT;

type Camera = { project: (p: V3) => [number, number, number] | null; pos: V3 };

function camera(width: number): Camera {
  const pos = CAM_POS;
  const yaw = Math.atan2(CAM_AIM[0] - pos[0], CAM_AIM[2] - pos[2]);
  const forward: V3 = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right: V3 = [-Math.cos(yaw), 0, Math.sin(yaw)]; // forward × up
  const f = width / 2 / Math.tan((FOV * Math.PI) / 360);
  return {
    pos,
    project: (p) => {
      const d: V3 = [p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]];
      const z = dot(d, forward);
      if (z < 2) return null;
      return [width / 2 + (f * dot(d, right)) / z, HORIZON - (f * SQUASH * d[1]) / z, z];
    },
  };
}

function poly(ctx: CanvasRenderingContext2D, pts: ([number, number, number] | null)[], fill: string) {
  if (pts.some((q) => !q)) return;
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q![0], q![1]) : ctx.moveTo(q![0], q![1])));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

// Everything that doesn't move, behind the garages' depth or not: drawn far to near.
function drawScenery(ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 4);
  sky.addColorStop(0, '#1a1d22');
  sky.addColorStop(1, '#262a31');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // The camera is in the infield, so the ground in front of it is grass.
  const grass = ctx.createLinearGradient(0, HORIZON, 0, height);
  grass.addColorStop(0, '#24452a');
  grass.addColorStop(1, '#2f5a35');
  ctx.fillStyle = grass;
  ctx.fillRect(0, HORIZON, width, height);

  type Item = { z: number; draw: () => void };
  const items: Item[] = [];
  const P = cam.project;

  // Grandstands round the outside of the straights and the far turn, packed with fans.
  const rand = seeded(5);
  const shirts = ['#e63b2e', '#2f6fe4', '#ffd23f', '#f4f4f6', '#1fb36b', '#ff7a1a', '#a04ee8', '#9a9da3', '#5c6068', '#c7c9ce'];
  const standR0 = R_OUT + 10;
  const standR1 = R_OUT + 52;
  const standY = (u: number) => 1.5 + u * 26;
  for (const section of [0, 1, 3]) {
    const steps = section === 0 ? 36 : 26;
    for (let i = 0; i < steps; i++) {
      const f0 = i / steps;
      const f1 = (i + 1) / steps;
      const corners = [spot(section, f0, standR0, standY(0)), spot(section, f1, standR0, standY(0)), spot(section, f1, standR1, standY(1)), spot(section, f0, standR1, standY(1))];
      const q = corners.map((c) => P(c.p));
      const z = Math.max(...q.map((v) => (v ? v[2] : 0)));
      items.push({
        z: z + 400,
        draw: () => {
          poly(ctx, q, '#2b2f37');
          // Fans.
          // As many fans as fit the stand's size on screen, so near stands look as packed as far ones.
          const area = q.every(Boolean) ? Math.abs(q.reduce((t, v, i) => t + v![0] * q[(i + 1) % 4]![1] - q[(i + 1) % 4]![0] * v![1], 0)) / 2 : 0;
          const n = Math.min(1600, Math.round(area / 2));
          ctx.globalAlpha = 0.7;
          for (let k = 0; k < n; k++) {
            const u = rand();
            const v = f0 + (f1 - f0) * rand();
            const pt = P(spot(section, v, standR0 + (standR1 - standR0) * u, standY(u)).p);
            if (!pt) continue;
            const s = Math.min(1.6, Math.max(0.7, 220 / pt[2]));
            ctx.fillStyle = shirts[Math.floor(rand() * shirts.length)];
            ctx.fillRect(pt[0], pt[1] - s, s, s * 1.2);
          }
          ctx.globalAlpha = 1;
          // Roof edge.
          const a = P(spot(section, f0, standR1, standY(1) + 4).p);
          const b = P(spot(section, f1, standR1, standY(1) + 4).p);
          const c = P(spot(section, f1, standR1 - 8, standY(1) + 4).p);
          const d = P(spot(section, f0, standR1 - 8, standY(1) + 4).p);
          poly(ctx, [a, b, c, d], '#474d57');
        },
      });
    }
  }

  // The concourse between the wall and the stands.
  for (const section of [0, 1, 3]) {
    for (let i = 0; i < 30; i++) {
      const q = [P(spot(section, i / 30, R_OUT, 1.3).p), P(spot(section, (i + 1) / 30, R_OUT, 1.3).p), P(spot(section, (i + 1) / 30, standR0, 1.5).p), P(spot(section, i / 30, standR0, 1.5).p)];
      if (q.some((v) => !v)) continue;
      items.push({ z: Math.max(...q.map((v) => v![2])) + 200, draw: () => poly(ctx, q, '#30343b') });
    }
  }

  // The racing surface in strips that lighten towards the top of the banking, the apron, the wall.
  const strips = 5;
  const seg = (section: number) => (section % 2 === 0 ? 48 : 30);
  for (const section of [0, 1, 3]) {
    for (let i = 0; i < seg(section); i++) {
      const f0 = i / seg(section);
      const f1 = (i + 1) / seg(section);
      for (let k = 0; k < strips; k++) {
        const r0 = R_IN + ((R_OUT - R_IN) * k) / strips;
        const r1 = R_IN + ((R_OUT - R_IN) * (k + 1)) / strips;
        const q = [P(spot(section, f0, r0).p), P(spot(section, f1, r0).p), P(spot(section, f1, r1).p), P(spot(section, f0, r1).p)];
        if (q.some((v) => !v)) continue;
        const g = 0x35 + Math.round((k / (strips - 1)) * 0x14);
        const colour = `rgb(${g},${g + 2},${g + 7})`;
        items.push({ z: Math.max(...q.map((v) => v![2])), draw: () => poly(ctx, q, colour) });
      }
      const apron = [P(spot(section, f0, R_IN - APRON, 0).p), P(spot(section, f1, R_IN - APRON, 0).p), P(spot(section, f1, R_IN).p), P(spot(section, f0, R_IN).p)];
      if (!apron.some((v) => !v)) items.push({ z: Math.max(...apron.map((v) => v![2])) + 0.5, draw: () => poly(ctx, apron, '#55585f') });
      // The wall: its face towards the track, or its back where it's between the camera and the track.
      const w0 = spot(section, f0, R_OUT);
      const w1 = spot(section, f1, R_OUT);
      const wall = [P(w0.p), P(w1.p), P(add(w1.p, [0, WALL, 0])), P(add(w0.p, [0, WALL, 0]))];
      if (!wall.some((v) => !v)) {
        const facing = dot(mul(w0.out, -1), norm(add(cam.pos, mul(w0.p, -1)))) > 0;
        items.push({ z: Math.min(...wall.map((v) => v![2])) - 0.5, draw: () => poly(ctx, wall, facing ? '#dcdfe4' : '#9a9ea6') });
      }
    }
  }
  items.sort((a, b) => b.z - a.z).forEach((it) => it.draw());

  // Lines painted on the track: double yellow at the bottom, white lane dashes, start/finish.
  const line = (r: number, colour: string, dash: boolean) => {
    for (const section of [0, 1, 3]) {
      const n = section % 2 === 0 ? 90 : 60;
      for (let i = 0; i < n; i++) {
        if (dash && i % 3 !== 0) continue;
        const a = P(spot(section, i / n, r).p);
        const b = P(spot(section, (i + 1) / n, r).p);
        if (!a || !b) continue;
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(0.5, 140 / a[2]);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
    }
  };
  // Rubber laid down in the racing groove, and tyre marks scattered across the banking.
  for (const section of [0, 1, 3]) {
    const n = section % 2 === 0 ? 90 : 60;
    for (let i = 0; i < n; i++) {
      const q = [P(spot(section, i / n, 95).p), P(spot(section, (i + 1) / n, 95).p), P(spot(section, (i + 1) / n, 99.5).p), P(spot(section, i / n, 99.5).p)];
      poly(ctx, q, 'rgba(0,0,0,.13)');
    }
  }
  const marks = seeded(17);
  for (let m = 0; m < 70; m++) {
    const section = [0, 0, 1, 3][Math.floor(marks() * 4)];
    let r = R_IN + 1.5 + marks() * (R_OUT - R_IN - 3);
    const drift = (marks() - 0.5) * 0.25;
    const f0 = marks() * 0.85;
    const len = 0.03 + marks() * 0.12;
    ctx.strokeStyle = `rgba(0,0,0,${(0.12 + marks() * 0.16).toFixed(2)})`;
    ctx.beginPath();
    let started = false;
    for (let k = 0; k <= 16; k++) {
      const pt = P(spot(section, f0 + (len * k) / 16, r).p);
      r += drift;
      if (!pt) continue;
      ctx.lineWidth = Math.max(0.4, 90 / pt[2]);
      if (started) ctx.lineTo(pt[0], pt[1]);
      else ctx.moveTo(pt[0], pt[1]);
      started = true;
    }
    ctx.stroke();
  }
  // Joints between the SAFER barrier panels, and the catch fence above the wall.
  for (const section of [0, 1, 3]) {
    const length = section === 0 ? Math.PI * R_OUT : STRAIGHT;
    const panels = Math.round(length / 6);
    for (let i = 0; i <= panels; i++) {
      const w = spot(section, i / panels, R_OUT);
      const a = P(w.p);
      const b = P(add(w.p, [0, WALL, 0]));
      if (!a || !b) continue;
      ctx.strokeStyle = 'rgba(0,0,0,.22)';
      ctx.lineWidth = Math.max(0.4, 40 / a[2]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    const posts = Math.round(length / 9);
    for (let i = 0; i <= posts; i++) {
      const w = spot(section, i / posts, R_OUT + 0.4);
      const a = P(add(w.p, [0, WALL, 0]));
      const b = P(add(w.p, [0, WALL + 5, 0]));
      if (!a || !b) continue;
      ctx.strokeStyle = 'rgba(150,156,166,.75)';
      ctx.lineWidth = Math.max(0.5, 60 / a[2]);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
    for (const h of [1.8, 3.4, 5]) {
      ctx.strokeStyle = 'rgba(150,156,166,.35)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i <= 60; i++) {
        const pt = P(add(spot(section, i / 60, R_OUT + 0.4).p, [0, WALL + h, 0]));
        if (!pt) {
          started = false;
          continue;
        }
        if (started) ctx.lineTo(pt[0], pt[1]);
        else ctx.moveTo(pt[0], pt[1]);
        started = true;
      }
      ctx.stroke();
    }
  }
  line(R_IN + 0.5, '#f0c419', false);
  line(R_IN + 1.3, '#f0c419', false);
  line((LANES[0] + LANES[1]) / 2, 'rgba(235,236,238,.75)', true);
  line((LANES[1] + LANES[2]) / 2, 'rgba(235,236,238,.75)', true);
  for (let k = 0; k < 8; k++) {
    for (let j = 0; j < 2; j++) {
      const r0 = R_IN + ((R_OUT - R_IN) * k) / 8;
      const r1 = R_IN + ((R_OUT - R_IN) * (k + 1)) / 8;
      const f0 = 0.72 + j * 0.006;
      const f1 = f0 + 0.006;
      poly(ctx, [P(spot(3, f0, r0).p), P(spot(3, f1, r0).p), P(spot(3, f1, r1).p), P(spot(3, f0, r1).p)], (k + j) % 2 ? '#f4f4f4' : '#111');
    }
  }
}

type Car = { lane: number; s0: number; livery: number; number: number };

function field(): Car[] {
  const rand = seeded(7);
  const cars: Car[] = [];
  // One pack, like a real race: the leader, then rows two and three wide, nose to tail.
  const rows = [1, 2, 2, 3, 2, 3, 2, 2, 3, 2, 3, 2, 3, 2, 2, 2];
  let s = 0;
  let n = 0;
  rows.forEach((wide, row) => {
    const lanes = wide === 3 ? [0, 1, 2] : wide === 2 ? (row % 2 ? [0, 1] : [1, 2]) : [1];
    for (const lane of lanes) {
      cars.push({ lane, s0: s - rand() * 0.8, livery: n % LIVERIES.length, number: NUMBERS[n % NUMBERS.length] });
      n++;
    }
    s -= 7.6 + rand() * 0.6;
  });
  return cars;
}

type Frame = { at: Spot; lat: V3; up: V3 };

function carFrame(at: Spot): Frame {
  const b = Math.atan(at.bank);
  return { at, lat: add(mul(at.out, Math.cos(b)), [0, Math.sin(b), 0]), up: add([0, Math.cos(b), 0], mul(at.out, -Math.sin(b))) };
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 150;
};

/** Paints `text` flat on a surface of the car, centred on `origin`, `size` metres tall. */
function decal(ctx: CanvasRenderingContext2D, cam: Camera, dpr: number, origin: V3, along: V3, across: V3, size: number, text: string, fill: string, outline: string) {
  const p0 = cam.project(origin);
  let p1 = cam.project(add(origin, along));
  let p2 = cam.project(add(origin, across));
  if (!p0 || !p1 || !p2) return;
  // Read left to right and upright, whichever side it's seen from.
  if (p1[0] < p0[0]) p1 = cam.project(add(origin, mul(along, -1)))!;
  if (p2[1] > p0[1]) p2 = cam.project(add(origin, mul(across, -1)))!;
  if (!p1 || !p2) return;
  const k = dpr / 100;
  ctx.save();
  ctx.setTransform((p1[0] - p0[0]) * k, (p1[1] - p0[1]) * k, -(p2[0] - p0[0]) * k, -(p2[1] - p0[1]) * k, p0[0] * dpr, p0[1] * dpr);
  ctx.font = `italic 900 ${Math.round(size * 100)}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 14;
  ctx.strokeStyle = outline;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawCar(ctx: CanvasRenderingContext2D, cam: Camera, dpr: number, fr: Frame, livery: [string, string], number: number) {
  const { at, lat, up } = fr;
  const point = (a: number, w: number, h: number) => add(add(add(at.p, mul(at.t, a)), mul(lat, w)), mul(up, h));
  const P = cam.project;
  const toCam = (c: V3) => norm(add(cam.pos, mul(c, -1)));
  const light = (n: V3) => 0.5 + 0.55 * Math.max(0, dot(n, SUN));
  const [body, trim] = livery;
  const numberFill = isLight(body) ? '#15171b' : '#ffffff';
  const numberEdge = isLight(body) ? '#ffffff' : '#15171b';

  // How big the car is on screen decides how much detail is worth drawing.
  const nose = P(point(CAR_L / 2, 0, 0.5));
  const tail = P(point(-CAR_L / 2, 0, 0.5));
  if (!nose || !tail) return;
  const screenLength = Math.hypot(nose[0] - tail[0], nose[1] - tail[1]);
  const detailed = screenLength > 22;

  // Front splitter, sticking out under the nose.
  poly(ctx, [point(2.6, -0.98, 0.09), point(2.84, -0.98, 0.09), point(2.84, 0.98, 0.09), point(2.6, 0.98, 0.09)].map(P), '#0f1013');

  // A prism from a side profile: both sides, then a panel for each edge of the profile.
  const prism = (profile: [number, number][], half: number, colourOf: (edge: number, n: V3) => string | null, sideColour: (n: V3) => string, onSide?: (side: number) => void) => {
    const ca = profile.reduce((t, p) => t + p[0], 0) / profile.length;
    const ch = profile.reduce((t, p) => t + p[1], 0) / profile.length;
    for (const side of [-1, 1]) {
      const n = mul(lat, side);
      const pts = profile.map(([a, h]) => point(a, side * half, h));
      const centre = mul(pts.reduce(add), 1 / pts.length);
      if (dot(n, toCam(centre)) <= 0) continue;
      poly(ctx, pts.map(P), sideColour(n));
      onSide?.(side);
    }
    for (let i = 0; i < profile.length; i++) {
      const [a0, h0] = profile[i];
      const [a1, h1] = profile[(i + 1) % profile.length];
      let na = h1 - h0;
      let nh = -(a1 - a0);
      if (na * ((a0 + a1) / 2 - ca) + nh * ((h0 + h1) / 2 - ch) < 0) [na, nh] = [-na, -nh];
      const n = norm(add(mul(at.t, na), mul(up, nh)));
      const pts = [point(a0, -half, h0), point(a1, -half, h1), point(a1, half, h1), point(a0, half, h0)];
      if (dot(n, toCam(mul(pts.reduce(add), 0.25))) <= 0) continue;
      const colour = colourOf(i, n);
      if (colour) poly(ctx, pts.map(P), colour);
    }
  };

  // The body. Edges: 0 front bumper, 1 nose, 2 bonnet, 3 under the cabin, 4 tail, 5 underside.
  prism(
    BODY,
    BODY_W,
    (edge, n) => (edge === 0 ? shade('#16171a', light(n)) : edge === 4 ? shade(body, light(n) * 0.75) : edge === 5 ? null : shade(body, light(n))),
    (n) => shade(body, light(n)),
    (side) => {
      if (!detailed) return;
      const w = side * (BODY_W + 0.01);
      const on = (a: number, h: number, out = 0) => point(a, w + side * out, h * EX);
      // The wrap: a swoosh of the second colour sweeping up the side towards the back.
      poly(ctx, [on(2.45, 0.42), on(0.7, 0.7), on(-2.45, 0.86), on(-2.45, 0.62), on(0.35, 0.5), on(2.3, 0.28)].map(P), shade(trim, 0.95));
      // Sheen along the shoulder.
      poly(ctx, [on(2.2, 0.62), on(-2.4, 0.84), on(-2.4, 0.9), on(2.2, 0.68)].map(P), 'rgba(255,255,255,.13)');
      // Black side skirt, and contingency stickers behind the front wheel.
      poly(ctx, [on(-2.58, 0.12), on(2.6, 0.12), on(2.62, 0.24), on(-2.6, 0.24)].map(P), '#111215');
      poly(ctx, [on(0.75, 0.3, 0.01), on(1.15, 0.3, 0.01), on(1.15, 0.5, 0.01), on(0.75, 0.5, 0.01)].map(P), 'rgba(245,245,245,.9)');
      // Black centre-lock wheels in their tyres.
      for (const axle of [1.62, -1.5]) {
        const ring = (r: number, k: number, out: number) => Array.from({ length: k }, (_, j) => on(axle + r * Math.cos((j / k) * Math.PI * 2), 0.36 + r * Math.sin((j / k) * Math.PI * 2), out));
        poly(ctx, ring(0.36, 12, 0.01).map(P), '#0b0c0e');
        poly(ctx, ring(0.25, 10, 0.02).map(P), '#1d1f23');
        poly(ctx, ring(0.07, 6, 0.03).map(P), '#9da3ab');
      }
      decal(ctx, cam, dpr, point(-0.25, w + side * 0.03, 0.6 * EX), at.t, up, 0.52 * EX, String(number), numberFill, numberEdge);
    },
  );
  if (detailed) {
    // Sponsor panel on the bonnet, and headlight stickers on the nose.
    const hood = (a: number, w: number) => point(a, w, hoodAt(a) + 0.01);
    poly(ctx, [hood(2.25, -0.64), hood(1.1, -0.64), hood(1.1, 0.64), hood(2.25, 0.64)].map(P), shade('#f4f4f4', light(up)));
    poly(ctx, [hood(2.25, -0.64), hood(1.85, -0.64), hood(1.85, 0.64), hood(2.25, 0.64)].map(P), shade(trim, light(up)));
    for (const side of [-1, 1]) {
      const n2 = (a: number, w: number, h: number) => point(a, side * w, h * EX);
      poly(ctx, [n2(2.67, 0.5, 0.46), n2(2.67, 0.86, 0.46), n2(2.5, 0.86, 0.6), n2(2.5, 0.5, 0.6)].map(P), '#f1ead2');
    }
  }
  // The cabin: glass all round, the roof in the body colour. Edges: 0 windscreen, 1 roof, 2 rear window.
  prism(
    GLASS,
    GLASS_W,
    (edge, n) => (edge === 1 ? shade(body, light(n)) : edge === 3 ? null : shade('#1e2229', light(n) * 0.9)),
    (n) => shade('#252931', light(n)),
  );
  if (detailed) {
    const screen = (a: number, w: number) => point(a, w, screenAt(a) + 0.01);
    // Glare, and the sponsor banner across the top of the windscreen.
    poly(ctx, [screen(0.8, -0.68), screen(0.55, -0.68), screen(0.2, 0.68), screen(0.45, 0.68)].map(P), 'rgba(255,255,255,.16)');
    poly(ctx, [screen(0.12, -0.7), screen(-0.04, -0.7), screen(-0.04, 0.7), screen(0.12, 0.7)].map(P), shade(trim, light(up)));
    decal(ctx, cam, dpr, point(-0.52, 0, ROOF + 0.01), mul(lat, -1), at.t, 0.85, String(number), numberFill, numberEdge);
  }
  // The tall rear spoiler across the full width of the deck.
  poly(ctx, [point(-2.48, -BODY_W, 0.93 * EX), point(-2.48, BODY_W, 0.93 * EX), point(-2.6, BODY_W, 1.13 * EX), point(-2.6, -BODY_W, 1.13 * EX)].map(P), '#0f1013');
}

function drawShadow(ctx: CanvasRenderingContext2D, cam: Camera, fr: Frame) {
  const { at, lat } = fr;
  // Cast a little away from the sun, along the track surface.
  const off = add(mul(lat, 0.5), mul(at.t, 0.4));
  const point = (a: number, w: number) => add(add(add(at.p, off), mul(at.t, a)), mul(lat, w));
  // A soft edge round a darker core.
  for (const [grow, alpha] of [[0.55, 0.18], [0.15, 0.32]]) {
    poly(ctx, [point(-CAR_L / 2 - grow, -CAR_W / 2 - grow), point(CAR_L / 2 + grow * 0.6, -CAR_W / 2 - grow), point(CAR_L / 2 + grow * 0.6, CAR_W / 2 + grow), point(-CAR_L / 2 - grow, CAR_W / 2 + grow)].map(cam.project), `rgba(0,0,0,${alpha})`);
  }
}

/**
 * Starts the scene on `canvas` (sized `width` × `height` CSS px). With `stillAt`, draws just that
 * moment (seconds in) and stops. Returns a function that stops it.
 */
export function startRace(canvas: HTMLCanvasElement, width: number, height: number, stillAt?: number) {
  const still = stillAt !== undefined;
  if (width < 1 || height < 1) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const cam = camera(width);

  const layer = (draw: (c: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const x = c.getContext('2d')!;
    x.scale(dpr, dpr);
    draw(x);
    return c;
  };
  const scenery = layer((x) => drawScenery(x, cam, width, height));

  const cars = field();
  const baseLap = lapLength(LANES[1]) / SPEED;
  let frame = 0;
  // The pack arrives about a second after the page opens.
  const start = performance.now() - 500;

  const render = (now: number) => {
    frame = still ? 0 : requestAnimationFrame(render);
    // Skip work while the guide it's in is hidden (the other country's tab).
    if (!still && !canvas.offsetParent) return;
    const t = (now - start) / 1000;
    const placed = cars.map((c) => {
      const r = LANES[c.lane];
      const speed = lapLength(r) / (baseLap * LANE_LAP[c.lane]);
      const surge = LANE_SURGE[c.lane];
      const at = laneSpot(r, c.s0 + speed * t + surge.size * Math.sin((t * Math.PI * 2) / surge.period + surge.phase));
      const p = cam.project(at.p);
      return { c, at, depth: p ? p[2] : -1 };
    });
    // Cars out of view (behind the camera, or round the far side) aren't drawn at all.
    const shown = placed.filter((p) => p.depth > 3 && p.depth < 900).sort((a, b) => b.depth - a.depth);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scenery, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const frames = shown.map((p) => ({ ...p, fr: carFrame(p.at) }));
    for (const { fr } of frames) drawShadow(ctx, cam, fr);
    for (const { c, fr } of frames) drawCar(ctx, cam, dpr, fr, LIVERIES[c.livery], c.number);
  };
  if (still) render(start + stillAt * 1000);
  else frame = requestAnimationFrame(render);
  return () => cancelAnimationFrame(frame);
}
