import * as THREE from "three";
import { seeded } from "./random";

/** Wall-clock length of the green to gold change. */
export const AUTUMN_TRANSITION_SECONDS = 2;

const AUTUMN_FOLIAGE = ["#d99a2b", "#e8b84a", "#c9821f", "#f0cf6b", "#b9701d", "#e2a93d"];
const AUTUMN_GRASS = ["#c8a74a", "#d8b95c", "#b8963f", "#e0c36e", "#c29a3a"];

// Each instance waits up to this share of the transition, then eases over the rest,
// so every instance has finished exactly when the transition ends.
const MAX_STAGGER = 0.45;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

type Layer = {
  mesh: THREE.InstancedMesh;
  base: Float32Array;
  target: Float32Array;
  start: Float32Array;
};

function buildLayer(
  mesh: THREE.InstancedMesh,
  palette: string[],
  random: () => number,
  staggerFor: (position: THREE.Vector3) => number,
): Layer {
  if (!mesh.instanceColor) throw new Error("Autumn layer needs per-instance colours");
  const colors = palette.map((hex) => new THREE.Color(hex));
  const count = mesh.count;
  const base = Float32Array.from(mesh.instanceColor.array as ArrayLike<number>);
  const target = new Float32Array(count * 3);
  const start = new Float32Array(count);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const tint = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    tint.copy(colors[Math.floor(random() * colors.length)]);
    tint.offsetHSL((random() - 0.5) * 0.015, 0, (random() - 0.5) * 0.07);
    target[i * 3] = tint.r;
    target[i * 3 + 1] = tint.g;
    target[i * 3 + 2] = tint.b;

    mesh.getMatrixAt(i, matrix);
    position.setFromMatrixPosition(matrix);
    start[i] = MAX_STAGGER * clamp01(staggerFor(position) + (random() - 0.5) * 0.18);
  }
  return { mesh, base, target, start };
}

export type AutumnAtmosphere = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  hemisphere: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
};

/**
 * Turns the pine's needles and the grass golden. Leaves turn from the crown
 * downwards and grass turns outwards from the trunk, with warmer light and fog.
 */
export class AutumnTransition {
  private readonly layers: Layer[];
  private startedAt: number | null = null;
  private progress = 0;

  private readonly fogFrom = new THREE.Color();
  private readonly fogTo = new THREE.Color("#3b3a2c");
  private readonly clearFrom = new THREE.Color();
  private readonly clearTo = new THREE.Color("#262a22");
  private readonly skyFrom = new THREE.Color();
  private readonly skyTo = new THREE.Color("#e4d3a8");
  private readonly keyFrom = new THREE.Color();
  private readonly keyTo = new THREE.Color("#ffc77a");
  private readonly rimFrom = new THREE.Color();
  private readonly rimTo = new THREE.Color("#e3c690");
  private readonly keyIntensityFrom: number;
  private readonly scratch = new THREE.Color();

  constructor(
    foliage: THREE.InstancedMesh,
    grass: THREE.InstancedMesh,
    private readonly atmosphere: AutumnAtmosphere,
  ) {
    const random = seeded(20261105);
    this.layers = [
      // Top of the crown first.
      buildLayer(foliage, AUTUMN_FOLIAGE, random, (p) => 1 - clamp01(p.y / 18)),
      // Closest to the trunk first.
      buildLayer(grass, AUTUMN_GRASS, random, (p) => clamp01(Math.hypot(p.x, p.z) / 14)),
    ];

    const { scene, renderer, hemisphere, key, rim } = atmosphere;
    if (scene.fog) this.fogFrom.copy((scene.fog as THREE.FogExp2).color);
    renderer.getClearColor(this.clearFrom);
    this.skyFrom.copy(hemisphere.color);
    this.keyFrom.copy(key.color);
    this.rimFrom.copy(rim.color);
    this.keyIntensityFrom = key.intensity;
  }

  get done() {
    return this.progress >= 1;
  }

  get started() {
    return this.startedAt !== null || this.progress >= 1;
  }

  /** Begins the change at `now` (ms), or applies it immediately. */
  start(now: number, instant = false) {
    if (this.started) return;
    if (instant) {
      this.progress = 1;
      this.apply(1);
    } else {
      this.startedAt = now;
    }
  }

  update(now: number) {
    if (this.startedAt === null || this.progress >= 1) return;
    const t = clamp01((now - this.startedAt) / (AUTUMN_TRANSITION_SECONDS * 1000));
    this.progress = t;
    this.apply(t);
  }

  /** Jumps to the end of the change if it is still under way. */
  finish() {
    if (this.startedAt === null || this.progress >= 1) return;
    this.progress = 1;
    this.apply(1);
  }

  private apply(t: number) {
    for (const { mesh, base, target, start } of this.layers) {
      const array = mesh.instanceColor!.array as Float32Array;
      for (let i = 0; i < start.length; i += 1) {
        const s = smooth(clamp01((t - start[i]) / (1 - MAX_STAGGER)));
        const o = i * 3;
        array[o] = base[o] + (target[o] - base[o]) * s;
        array[o + 1] = base[o + 1] + (target[o + 1] - base[o + 1]) * s;
        array[o + 2] = base[o + 2] + (target[o + 2] - base[o + 2]) * s;
      }
      mesh.instanceColor!.needsUpdate = true;
    }

    const e = smooth(t);
    const { scene, renderer, hemisphere, key, rim } = this.atmosphere;
    if (scene.fog) (scene.fog as THREE.FogExp2).color.lerpColors(this.fogFrom, this.fogTo, e);
    renderer.setClearColor(this.scratch.lerpColors(this.clearFrom, this.clearTo, e), 1);
    hemisphere.color.lerpColors(this.skyFrom, this.skyTo, e);
    key.color.lerpColors(this.keyFrom, this.keyTo, e);
    key.intensity = this.keyIntensityFrom + (3.5 - this.keyIntensityFrom) * e;
    rim.color.lerpColors(this.rimFrom, this.rimTo, e);
  }
}
