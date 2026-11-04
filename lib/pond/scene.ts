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

const SLAB_W = 230;
const SLAB_H = 115;
const GAP = 5;

/** A static wet concrete paving-slab walkway, redrawn only when resized. */
export class PondScene {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dirty = true;

  constructor() {
    this.canvas = document.createElement("canvas");
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
  }

  /** Size is given in CSS px; `scale` is the backing-store ratio. */
  resize(cssW: number, cssH: number, scale: number) {
    this.canvas.width = Math.max(1, Math.round(cssW * scale));
    this.canvas.height = Math.max(1, Math.round(cssH * scale));
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.paint(cssW, cssH);
    this.dirty = true;
  }

  /** Returns true when the canvas content changed since the last call. */
  draw(): boolean {
    const changed = this.dirty;
    this.dirty = false;
    return changed;
  }

  private paint(w: number, h: number) {
    const { ctx } = this;
    const rand = rng(11);

    ctx.fillStyle = "#1d1f21";
    ctx.fillRect(0, 0, w, h);

    const rows = Math.ceil(h / SLAB_H) + 1;
    const cols = Math.ceil(w / SLAB_W) + 2;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (SLAB_W / 2) - SLAB_W / 2;
      for (let c = 0; c < cols; c++) {
        const x = c * SLAB_W + offset + GAP / 2;
        const y = r * SLAB_H + GAP / 2;
        const sw = SLAB_W - GAP;
        const sh = SLAB_H - GAP;
        const light = 31 + rand() * 9;
        const hue = 205 + rand() * 20;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, sw, sh, 4);
        ctx.clip();

        const g = ctx.createLinearGradient(x, y, x + sw * 0.4, y + sh);
        g.addColorStop(0, `hsl(${hue}, 4%, ${light + 3}%)`);
        g.addColorStop(1, `hsl(${hue}, 5%, ${light - 3}%)`);
        ctx.fillStyle = g;
        ctx.fillRect(x, y, sw, sh);

        for (let i = 0; i < 2; i++) {
          const bx = x + rand() * sw;
          const by = y + rand() * sh;
          const br = 30 + rand() * 60;
          const blot = ctx.createRadialGradient(bx, by, 0, bx, by, br);
          blot.addColorStop(0, rand() > 0.5 ? "rgba(10,14,18,0.22)" : "rgba(170,185,200,0.08)");
          blot.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = blot;
          ctx.fillRect(x, y, sw, sh);
        }

        const dots = Math.round((sw * sh) / 14);
        for (let i = 0; i < dots; i++) {
          ctx.fillStyle =
            rand() > 0.45
              ? `rgba(8,10,12,${0.06 + rand() * 0.18})`
              : `rgba(190,200,210,${0.04 + rand() * 0.12})`;
          const size = rand() < 0.08 ? 2 : 1;
          ctx.fillRect(x + rand() * sw, y + rand() * sh, size, size);
        }

        if (rand() < 0.35) {
          ctx.strokeStyle = "rgba(5,7,9,0.45)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          let cx = x + rand() * sw;
          let cy = y;
          ctx.moveTo(cx, cy);
          const steps = 4 + Math.floor(rand() * 4);
          for (let i = 0; i < steps; i++) {
            cx += (rand() - 0.5) * 36;
            cy += (sh / steps) * (0.6 + rand() * 0.6);
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }

        ctx.strokeStyle = "rgba(200,210,225,0.14)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y + 0.75, sw - 1.5, sh - 1.5);
        ctx.restore();
      }
    }

    const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }
}
