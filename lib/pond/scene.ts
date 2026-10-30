export type Food = { x: number; y: number; born: number };

type Koi = {
  x: number;
  y: number;
  angle: number;
  speed: number;
  turn: number;
  phase: number;
  size: number;
  spine: { x: number; y: number }[];
  patches: { at: number; r: number; color: string }[];
  base: string;
};

type Pad = { x: number; y: number; r: number; notch: number; hue: number; flower: boolean; phase: number };

const SEGMENTS = 14;
const FOOD_LIFETIME = 4;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KOI_STYLES = [
  { base: "#f4efe6", spots: ["#e8541f", "#e8541f", "#1c1c1c"] },
  { base: "#e8541f", spots: ["#f4efe6", "#f4efe6"] },
  { base: "#f4efe6", spots: ["#d93b1c", "#f2a33a"] },
  { base: "#f0b13a", spots: ["#f4efe6", "#d93b1c"] },
  { base: "#f4efe6", spots: ["#e8541f", "#1c1c1c", "#1c1c1c"] },
];

function bodyRadius(size: number, i: number, n: number) {
  const t = i / (n - 1);
  const swell = Math.sin(Math.min(1, t * 1.6 + 0.2) * Math.PI * 0.62) ** 1.2;
  return Math.max(size * 0.12, size * (0.2 + 0.8 * swell) * (1 - t * 0.55));
}

export class PondScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private koi: Koi[] = [];
  private pads: Pad[] = [];
  private food: Food[] = [];
  private w = 1;
  private h = 1;
  private scale = 1;
  private last = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    const rand = rng(7);
    this.pads = Array.from({ length: 10 }, (_, i) => ({
      x: rand(),
      y: rand(),
      r: 0.045 + rand() * 0.04,
      notch: rand() * Math.PI * 2,
      hue: 128 + rand() * 20,
      flower: i % 4 === 1,
      phase: rand() * 6.28,
    }));
  }

  /** Size is given in CSS px; `scale` is the backing-store ratio. */
  resize(cssW: number, cssH: number, scale: number) {
    const first = this.koi.length === 0;
    this.w = cssW;
    this.h = cssH;
    this.scale = scale;
    this.canvas.width = Math.max(1, Math.round(cssW * scale));
    this.canvas.height = Math.max(1, Math.round(cssH * scale));
    if (first) this.spawnKoi();
  }

  private spawnKoi() {
    const rand = rng(21);
    const unit = Math.min(this.w, this.h);
    this.koi = KOI_STYLES.map((style, i) => {
      const x = this.w * (0.15 + rand() * 0.7);
      const y = this.h * (0.15 + rand() * 0.7);
      const angle = rand() * Math.PI * 2;
      const size = unit * (0.03 + rand() * 0.012);
      return {
        x,
        y,
        angle,
        speed: 28 + rand() * 18,
        turn: 0,
        phase: rand() * 10,
        size,
        base: style.base,
        patches: Array.from({ length: 3 + (i % 2) }, () => ({
          at: 1 + Math.floor(rand() * (SEGMENTS - 4)),
          r: 0.55 + rand() * 0.4,
          color: style.spots[Math.floor(rand() * style.spots.length)],
        })),
        spine: Array.from({ length: SEGMENTS }, (_, k) => ({
          x: x - Math.cos(angle) * size * 0.55 * k,
          y: y - Math.sin(angle) * size * 0.55 * k,
        })),
      };
    });
  }

  feed(x: number, y: number, time: number) {
    this.food.push({ x, y, born: time });
    if (this.food.length > 6) this.food.shift();
  }

  private step(time: number, dt: number) {
    this.food = this.food.filter((f) => time - f.born < FOOD_LIFETIME);
    for (const k of this.koi) {
      let target: number | null = null;
      let nearest = Infinity;
      for (const f of this.food) {
        const d = Math.hypot(f.x - k.x, f.y - k.y);
        if (d < nearest) {
          nearest = d;
          target = Math.atan2(f.y - k.y, f.x - k.x);
        }
      }

      const wander = Math.sin(time * 0.35 + k.phase) * 0.9 + Math.sin(time * 0.83 + k.phase * 2) * 0.5;
      let desired = k.angle + wander * dt * 1.2;
      const margin = Math.min(this.w, this.h) * 0.12;
      if (k.x < margin || k.x > this.w - margin || k.y < margin || k.y > this.h - margin) {
        desired = Math.atan2(this.h / 2 - k.y, this.w / 2 - k.x);
      }
      if (target !== null) desired = target;

      let diff = desired - k.angle;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const rate = target !== null ? 2.6 : 1.1;
      k.turn += (diff * rate - k.turn) * Math.min(1, dt * 4);
      k.angle += k.turn * dt;

      const hungry = target !== null && nearest > k.size * 1.2;
      const speed = hungry ? k.speed * 2.4 : target !== null ? k.speed * 0.4 : k.speed;
      k.x += Math.cos(k.angle) * speed * dt;
      k.y += Math.sin(k.angle) * speed * dt;

      const head = k.spine[0];
      head.x = k.x;
      head.y = k.y;
      const gap = k.size * 0.55;
      for (let i = 1; i < k.spine.length; i++) {
        const prev = k.spine[i - 1];
        const cur = k.spine[i];
        const sway = Math.sin(time * 5 + k.phase - i * 0.55) * 0.05 * (speed / k.speed);
        const a = Math.atan2(cur.y - prev.y, cur.x - prev.x) + sway;
        cur.x = prev.x + Math.cos(a) * gap;
        cur.y = prev.y + Math.sin(a) * gap;
      }
    }
  }

  draw(time: number) {
    const dt = Math.min(0.05, this.last ? time - this.last : 0.016);
    this.last = time;
    if (this.koi.length) this.step(time, dt);

    const { ctx, w, h } = this;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);

    const bg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    bg.addColorStop(0, "#1f5b52");
    bg.addColorStop(0.55, "#12403b");
    bg.addColorStop(1, "#071d1c");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.drawDepth(time);
    this.drawKoi(time, true);
    this.drawKoi(time, false);
    this.drawPads(time);
    this.drawFood(time);
  }

  private drawDepth(time: number) {
    const { ctx, w, h } = this;
    const rand = rng(3);
    for (let i = 0; i < 14; i++) {
      const x = rand() * w + Math.sin(time * 0.05 + i) * 30;
      const y = rand() * h + Math.cos(time * 0.04 + i * 2) * 30;
      const r = (0.06 + rand() * 0.12) * Math.max(w, h);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, i % 3 === 0 ? "rgba(2,14,12,0.35)" : "rgba(70,150,120,0.10)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  private drawKoi(time: number, shadow: boolean) {
    const { ctx } = this;
    for (const k of this.koi) {
      ctx.save();
      if (shadow) ctx.translate(k.size * 0.35, k.size * 0.55);
      const alpha = shadow ? 0.28 : 1;
      const color = (c: string) => (shadow ? "#000" : c);
      const n = k.spine.length;
      const tail = k.spine[n - 1];
      const before = k.spine[n - 3];
      const tailAngle = Math.atan2(tail.y - before.y, tail.x - before.x);
      const flap = Math.sin(time * 5 + k.phase) * 0.35;

      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = color("#f2e9dc");
      ctx.save();
      ctx.translate(tail.x, tail.y);
      ctx.rotate(tailAngle + flap * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(k.size * 1.1, -k.size * 0.9, k.size * 1.9, -k.size * 0.5 + flap * k.size * 0.4);
      ctx.quadraticCurveTo(k.size * 1.3, 0, k.size * 1.9, k.size * 0.5 + flap * k.size * 0.4);
      ctx.quadraticCurveTo(k.size * 1.1, k.size * 0.9, 0, 0);
      ctx.fill();
      ctx.restore();

      for (const i of [3, 4]) {
        const s = k.spine[i];
        const p = k.spine[i - 1];
        const a = Math.atan2(s.y - p.y, s.x - p.x);
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(a + side * (1.1 + flap * 0.5));
          ctx.beginPath();
          ctx.ellipse(k.size * 0.5, 0, k.size * 0.55, k.size * 0.16, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.globalAlpha = alpha;
      for (let i = n - 1; i > 0; i--) {
        const a = k.spine[i];
        const b = k.spine[i - 1];
        const ra = bodyRadius(k.size, i, n);
        const rb = bodyRadius(k.size, i - 1, n);
        ctx.fillStyle = color(k.base);
        for (let s = 0; s < 4; s++) {
          const f = s / 4;
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, ra + (rb - ra) * f, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = color(k.base);
      ctx.beginPath();
      ctx.arc(k.spine[0].x, k.spine[0].y, bodyRadius(k.size, 0, n), 0, Math.PI * 2);
      ctx.fill();
      if (!shadow) {
        for (const p of k.patches) {
          const at = Math.min(p.at, n - 1);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(k.spine[at].x, k.spine[at].y, bodyRadius(k.size, at, n) * p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        const head = k.spine[0];
        const next = k.spine[1];
        const a = Math.atan2(head.y - next.y, head.x - next.x);
        ctx.fillStyle = "#1a1a1a";
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(
            head.x + Math.cos(a + side * 0.9) * k.size * 0.62,
            head.y + Math.sin(a + side * 0.9) * k.size * 0.62,
            k.size * 0.1,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawPads(time: number) {
    const { ctx, w, h } = this;
    const unit = Math.max(w, h);
    for (const p of this.pads) {
      const x = p.x * w + Math.sin(time * 0.3 + p.phase) * 3;
      const y = p.y * h + Math.cos(time * 0.27 + p.phase) * 3;
      const r = p.r * unit;

      ctx.save();
      ctx.translate(x + r * 0.12, y + r * 0.2);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      this.padPath(r, p.notch);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(x, y);
      const g = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r);
      g.addColorStop(0, `hsl(${p.hue}, 48%, 40%)`);
      g.addColorStop(1, `hsl(${p.hue + 8}, 55%, 24%)`);
      ctx.fillStyle = g;
      this.padPath(r, p.notch);
      ctx.fill();
      ctx.strokeStyle = `hsla(${p.hue}, 40%, 55%, 0.35)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const a = p.notch + 0.5 + (i / 7) * (Math.PI * 2 - 1);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
        ctx.stroke();
      }
      if (p.flower) {
        ctx.fillStyle = "#f6b8cf";
        for (let i = 0; i < 8; i++) {
          ctx.save();
          ctx.rotate((i / 8) * Math.PI * 2);
          ctx.beginPath();
          ctx.ellipse(r * 0.28, 0, r * 0.3, r * 0.11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = "#f7d56a";
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private padPath(r: number, notch: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, notch + 0.22, notch + Math.PI * 2 - 0.22);
    ctx.closePath();
  }

  private drawFood(time: number) {
    const { ctx } = this;
    for (const f of this.food) {
      const age = time - f.born;
      if (age > 1.2) continue;
      const sink = Math.min(1, age / 1.2);
      ctx.globalAlpha = 1 - sink;
      ctx.fillStyle = "#e9c46a";
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6 * (1 - sink * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#b8862d";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
