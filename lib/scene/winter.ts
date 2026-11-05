import * as THREE from "three";
import { buildTreeSnowGeometry } from "./snow-cap";
import { seeded } from "./random";

/** Wall-clock length of the change to winter, matching autumn. */
export const WINTER_TRANSITION_SECONDS = 2;

type Vec3 = [number, number, number];

const SNOW_GRASS = ["#e4edf4", "#d7e2ec", "#d0dbe6", "#e8eef4", "#c9d6e2"];
/** Upward-face tint. Pine bark is not given this, so the trunk shaft stays its own colour. */
const TREE_SNOW_RGB: readonly [number, number, number] = [0.94, 0.97, 1.0];
/**
 * Ground snow, a step under the tree white. Near-white instance tints sit on a
 * darker base material, so the clearing does not get darkened twice.
 */
const GROUND_SNOW_TINTS = ["#ffffff", "#f3f7fb", "#eaf1f6", "#f7fafc"];
const GROUND_SNOW_RGB: readonly [number, number, number] = [0.84, 0.88, 0.93];
const GROUND_MOUNDS = 1800;
const GROUND_CLUMPS = 6200;
const FLAKES = 3200;
const FLAKE_WIDTH = 46;
const FLAKE_HEIGHT = 24;

// Leaves start falling up to this share of the transition and need the rest to land.
const LEAF_MAX_DELAY = 0.45;
const GRASS_MAX_DELAY = 0.45;
const CLUMP_MAX_DELAY = 0.5;
// How much of its height a grass blade keeps once buried.
const BURIED_GRASS = 0.2;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export type SnowUniform = { value: number };

/**
 * Lets a standard material turn white where its surface faces upwards, driven by
 * `uniform.value` (0 = bare, 1 = covered). Must run before the material first renders.
 */
export function patchSnowMaterial(
  material: THREE.MeshStandardMaterial,
  uniform: SnowUniform,
  snowRgb: readonly [number, number, number] = TREE_SNOW_RGB,
) {
  const snowLiteral = `vec3(${snowRgb.map((channel) => channel.toFixed(3)).join(", ")})`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = uniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSnowWorld;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSnowWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uSnow;
         varying vec3 vSnowWorld;
         float snowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
         float snowNoise(vec2 p) {
           vec2 i = floor(p);
           vec2 f = fract(p);
           f = f * f * (3.0 - 2.0 * f);
           return mix(mix(snowHash(i), snowHash(i + vec2(1.0, 0.0)), f.x),
                      mix(snowHash(i + vec2(0.0, 1.0)), snowHash(i + vec2(1.0, 1.0)), f.x), f.y);
         }`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
         {
           vec3 snowNormal = inverseTransformDirection(normal, viewMatrix);
           float broad = snowNoise(vSnowWorld.xz * 1.1 + vSnowWorld.y * 0.35);
           float fine = snowNoise(vSnowWorld.xz * 6.3 + vSnowWorld.y * 2.0);
           float grain = broad * 0.7 + fine * 0.3;
           float facing = clamp(snowNormal.y, 0.0, 1.0);
           // Upward faces are fully covered; sides catch soft, irregular plastering.
           float cover = uSnow * smoothstep(-0.55, 0.4, facing + (grain - 0.5) * 0.8);
           vec3 snowColor = ${snowLiteral} * (0.92 + fine * 0.1);
           diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, cover);
           roughnessFactor = mix(roughnessFactor, 1.0, cover);
         }`,
      );
  };
}

function lumpHash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** A soft, rounded pillow; positions are hashed so shared seam vertices stay welded. */
function snowClumpGeometry() {
  const geometry = new THREE.SphereGeometry(1, 16, 11);
  const position = geometry.getAttribute("position");
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const lump = lumpHash(v.x, v.y, v.z) * 0.1 + Math.sin(v.x * 4.3 + v.z * 3.1) * 0.05;
    v.multiplyScalar(0.92 + lump);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function snowflakeTexture(size = 32) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.pow(clamp01(1 - d), 1.6);
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = 255;
      data[o + 3] = Math.round(a * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

export type SnowCap = { parent: THREE.Object3D; position: Vec3; radii: Vec3 };

export type WinterParts = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  hemisphere: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  tree: THREE.Object3D;
  foliage: THREE.InstancedMesh;
  grass: THREE.InstancedMesh;
  litter: THREE.InstancedMesh;
  /** Surfaces whose upward faces take a snow tint. Pine bark is not one of them. */
  snowy: THREE.MeshStandardMaterial[];
  /** Ground, and stones in it. A step darker than the tree snow. */
  groundSnowy: THREE.MeshStandardMaterial[];
  /** Far to near ridgelines. */
  mountains: THREE.MeshBasicMaterial[];
  caps: SnowCap[];
  groundHeight: (x: number, z: number) => number;
};

type Snapshot = {
  fog: THREE.Color;
  fogDensity: number;
  clear: THREE.Color;
  sky: THREE.Color;
  ground: THREE.Color;
  hemisphere: number;
  key: THREE.Color;
  keyIntensity: number;
  rim: THREE.Color;
  rimIntensity: number;
  fill: THREE.Color;
  fillIntensity: number;
  exposure: number;
  mountains: { color: THREE.Color; opacity: number }[];
  grass: Float32Array;
};

const MOUNTAIN_TARGETS = [
  { color: "#f4f8fb", opacity: 0.55 },
  { color: "#e5edf4", opacity: 0.5 },
  { color: "#d2dfe9", opacity: 0.45 },
];

/**
 * Winter: the needles fall and vanish, grass is buried, low drifts cover the ground,
 * and a narrow ridge of snow settles on top of each limb. Vertical bark stays its own
 * colour. Snow falls, and the light turns pale and cool.
 */
export class WinterTransition {
  readonly flakeTexture: THREE.Texture;
  private readonly snow: SnowUniform = { value: 0 };
  private readonly time = { value: 0 };
  private startedAt: number | null = null;
  private progress = 0;
  private snap: Snapshot | null = null;

  private readonly foliageBase: Float32Array;
  private readonly foliageCount: number;
  private readonly leafDelay: Float32Array;
  private readonly leafDrift: Float32Array;

  private readonly litterBase: Float32Array;
  private readonly litterCount: number;

  private readonly grassBase: Float32Array;
  private readonly grassDelay: Float32Array;
  private readonly grassTarget: Float32Array;

  private readonly groundClumps: THREE.InstancedMesh;
  private readonly branchSnow: THREE.Mesh;
  private readonly branchFinalY: Float32Array;
  private readonly branchSink: Float32Array;
  private branchEase = -1;
  private readonly clump: Float32Array; // x, y, z, sx, sy, sz, cos, sin, delay
  private readonly clumpTotal: number;

  private readonly flakes: THREE.Points;
  private readonly caps: { mesh: THREE.Mesh; radii: Vec3 }[] = [];
  private readonly scratch = new THREE.Color();
  private readonly targets: Record<"fog" | "clear" | "sky" | "ground" | "key" | "rim" | "fill", THREE.Color>;

  constructor(private readonly parts: WinterParts) {
    const random = seeded(20261106);
    const { scene, foliage, grass, litter } = parts;

    parts.snowy.forEach((material) => patchSnowMaterial(material, this.snow, TREE_SNOW_RGB));
    parts.groundSnowy.forEach((material) => patchSnowMaterial(material, this.snow, GROUND_SNOW_RGB));

    this.targets = {
      fog: new THREE.Color("#cdd9e2"),
      clear: new THREE.Color("#a9b9c7"),
      sky: new THREE.Color("#e3edf6"),
      ground: new THREE.Color("#7d8fa0"),
      key: new THREE.Color("#f1f4ff"),
      rim: new THREE.Color("#d6e7ff"),
      fill: new THREE.Color("#b8cadd"),
    };

    // Needles: remember the originals, and give each its own delay and sideways drift.
    this.foliageCount = foliage.count;
    this.foliageBase = Float32Array.from(foliage.instanceMatrix.array as ArrayLike<number>);
    this.leafDelay = new Float32Array(this.foliageCount);
    this.leafDrift = new Float32Array(this.foliageCount * 2);
    for (let i = 0; i < this.foliageCount; i += 1) {
      this.leafDelay[i] = LEAF_MAX_DELAY * random();
      this.leafDrift[i * 2] = (random() - 0.5) * 1.6;
      this.leafDrift[i * 2 + 1] = (random() - 0.5) * 1.6;
    }

    this.litterCount = litter.count;
    this.litterBase = Float32Array.from(litter.instanceMatrix.array as ArrayLike<number>);

    // Grass: buried from the trunk outwards, tinted white.
    const grassCount = grass.count;
    this.grassBase = Float32Array.from(grass.instanceMatrix.array as ArrayLike<number>);
    this.grassDelay = new Float32Array(grassCount);
    this.grassTarget = new Float32Array(grassCount * 3);
    const snowGrass = SNOW_GRASS.map((hex) => new THREE.Color(hex));
    for (let i = 0; i < grassCount; i += 1) {
      const radial = Math.hypot(this.grassBase[i * 16 + 12], this.grassBase[i * 16 + 14]);
      this.grassDelay[i] = GRASS_MAX_DELAY * clamp01(radial / 15 + (random() - 0.5) * 0.2);
      const colour = snowGrass[Math.floor(random() * snowGrass.length)];
      this.grassTarget[i * 3] = colour.r;
      this.grassTarget[i * 3 + 1] = colour.g;
      this.grassTarget[i * 3 + 2] = colour.b;
    }

    // Ground drifts stay low and wide. Limb snow is a separate narrow ridge.
    // The ground mesh is a darker white than the snow on the tree.
    this.clumpTotal = GROUND_CLUMPS;
    this.clump = new Float32Array(this.clumpTotal * 9);
    const groundPalette = GROUND_SNOW_TINTS.map((hex) => new THREE.Color(hex));
    const clumpGeometry = snowClumpGeometry();
    const groundClumpMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4e0ea,
      roughness: 0.97,
      metalness: 0,
      emissive: 0xc5d4e2,
      emissiveIntensity: 0.05,
    });
    this.groundClumps = new THREE.InstancedMesh(clumpGeometry, groundClumpMaterial, GROUND_CLUMPS);
    for (let i = 0; i < GROUND_CLUMPS; i += 1) {
      const o = i * 9;
      const angle = random() * Math.PI * 2;
      const distance = 1.1 + Math.pow(random(), 0.62) * 16.5;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      // Broad low mounds make the rolling drifts; small tall puffs on top read as cotton-soft powder.
      // Both stay low enough not to bury the monk or the puppy.
      const mound = i < GROUND_MOUNDS;
      const size = mound ? 0.8 + random() * 0.7 : 0.2 + Math.pow(random(), 1.5) * 0.3;
      const sy = mound ? size * (0.08 + 0.05 * random()) : size * (0.45 + 0.25 * random());
      this.clump.set(
        [x, parts.groundHeight(x, z) + sy * 0.15, z, size * (0.9 + 0.5 * random()), sy, size * (0.9 + 0.5 * random()), Math.cos(angle), Math.sin(angle), CLUMP_MAX_DELAY * random()],
        o,
      );
      this.groundClumps.setColorAt(i, groundPalette[Math.floor(random() * groundPalette.length)]);
    }
    this.groundClumps.count = 0;
    this.groundClumps.frustumCulled = false;
    this.groundClumps.receiveShadow = true;
    if (this.groundClumps.instanceColor) this.groundClumps.instanceColor.needsUpdate = true;

    const treeSnow = buildTreeSnowGeometry(parts.tree);
    this.branchFinalY = treeSnow.finalY;
    this.branchSink = treeSnow.sink;
    const branchMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
      emissive: 0xdce9f6,
      emissiveIntensity: 0.16,
      vertexColors: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.branchSnow = new THREE.Mesh(treeSnow.geometry, branchMaterial);
    this.branchSnow.visible = false;
    this.branchSnow.frustumCulled = false;
    this.branchSnow.receiveShadow = true;
    this.branchSnow.castShadow = false;
    this.branchSnow.renderOrder = 2;
    this.writeBranchSnow(0);
    scene.add(this.groundClumps, this.branchSnow);

    // Little snow caps on the monk and the puppy.
    const capMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      emissive: 0xdce9f6,
      emissiveIntensity: 0.12,
    });
    const capGeometry = snowClumpGeometry();
    parts.caps.forEach((cap) => {
      const mesh = new THREE.Mesh(capGeometry, capMaterial);
      mesh.position.set(...cap.position);
      mesh.scale.setScalar(0.0001);
      mesh.visible = false;
      cap.parent.add(mesh);
      this.caps.push({ mesh, radii: cap.radii });
    });

    // Falling snow.
    this.flakeTexture = snowflakeTexture();
    const flakePositions = new Float32Array(FLAKES * 3);
    for (let i = 0; i < FLAKES; i += 1) {
      flakePositions[i * 3] = (random() - 0.5) * FLAKE_WIDTH;
      flakePositions[i * 3 + 1] = random() * FLAKE_HEIGHT;
      flakePositions[i * 3 + 2] = (random() - 0.5) * FLAKE_WIDTH;
    }
    const flakeGeometry = new THREE.BufferGeometry();
    flakeGeometry.setAttribute("position", new THREE.BufferAttribute(flakePositions, 3));
    const flakeMaterial = new THREE.PointsMaterial({
      map: this.flakeTexture,
      color: 0xffffff,
      size: 0.17,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    flakeMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           float seed = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453);
           transformed.y = mod(position.y - uTime * (0.9 + seed * 1.3), ${FLAKE_HEIGHT}.0);
           transformed.x += sin(uTime * (0.4 + seed) + position.z) * 0.6;
           transformed.z += cos(uTime * (0.3 + seed) + position.x) * 0.5;`,
        );
    };
    this.flakes = new THREE.Points(flakeGeometry, flakeMaterial);
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    scene.add(this.flakes);
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
    this.capture();
    this.groundClumps.count = GROUND_CLUMPS;
    this.branchSnow.visible = true;
    this.flakes.visible = true;
    this.caps.forEach(({ mesh }) => {
      mesh.visible = true;
    });
    if (instant) {
      this.progress = 1;
      this.apply(1);
    } else {
      this.startedAt = now;
    }
  }

  /** Advances the animation. Snow keeps falling after the change itself is over. */
  update(now: number, reduceMotion = false) {
    this.time.value = reduceMotion ? 0 : now / 1000;
    if (this.startedAt === null || this.progress >= 1) return;
    const t = clamp01((now - this.startedAt) / (WINTER_TRANSITION_SECONDS * 1000));
    this.progress = t;
    this.apply(t);
  }

  private capture() {
    const { scene, renderer, hemisphere, key, rim, fill, grass, mountains } = this.parts;
    const fog = scene.fog as THREE.FogExp2;
    this.snap = {
      fog: fog.color.clone(),
      fogDensity: fog.density,
      clear: renderer.getClearColor(new THREE.Color()),
      sky: hemisphere.color.clone(),
      ground: hemisphere.groundColor.clone(),
      hemisphere: hemisphere.intensity,
      key: key.color.clone(),
      keyIntensity: key.intensity,
      rim: rim.color.clone(),
      rimIntensity: rim.intensity,
      fill: fill.color.clone(),
      fillIntensity: fill.intensity,
      exposure: renderer.toneMappingExposure,
      mountains: mountains.map((m) => ({ color: m.color.clone(), opacity: m.opacity })),
      grass: Float32Array.from(grass.instanceColor!.array as ArrayLike<number>),
    };
  }

  /** The ridge grows upward out of the wood. Width is already the final footprint. */
  private writeBranchSnow(t: number) {
    const ease = t <= 0 ? 0 : easeOut(clamp01((t - 0.12) / 0.88));
    if (Math.abs(ease - this.branchEase) < 1e-4) return;
    const settled = ease >= 1 && this.branchEase < 1;
    this.branchEase = ease;
    const position = this.branchSnow.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i += 1) {
      const sink = i < this.branchSink.length ? this.branchSink[i] : 0;
      const full = i < this.branchFinalY.length ? this.branchFinalY[i] : position.getY(i);
      position.setY(i, full - sink * (1 - ease));
    }
    position.needsUpdate = true;
    if (settled || ease < 1) this.branchSnow.geometry.computeVertexNormals();
  }

  private apply(t: number) {
    const snap = this.snap!;
    const { scene, renderer, hemisphere, key, rim, fill, foliage, grass, litter } = this.parts;

    // Needles drop to the ground and shrink away.
    const foliageArray = foliage.instanceMatrix.array as Float32Array;
    for (let i = 0; i < this.foliageCount; i += 1) {
      const s = clamp01((t - this.leafDelay[i]) / (1 - LEAF_MAX_DELAY));
      const k = 1 - smooth(clamp01((s - 0.6) / 0.4));
      const o = i * 16;
      const base = this.foliageBase;
      for (const c of [0, 1, 2, 4, 5, 6, 8, 9, 10]) foliageArray[o + c] = base[o + c] * k;
      foliageArray[o + 12] = base[o + 12] + this.leafDrift[i * 2] * s;
      foliageArray[o + 13] = base[o + 13] - Math.max(0, base[o + 13] - 0.05) * 0.95 * s * s;
      foliageArray[o + 14] = base[o + 14] + this.leafDrift[i * 2 + 1] * s;
    }
    foliage.instanceMatrix.needsUpdate = true;
    foliage.count = t >= 1 ? 0 : this.foliageCount;

    // Fallen needles on the ground are covered.
    const litterArray = litter.instanceMatrix.array as Float32Array;
    const litterK = 1 - smooth(clamp01((t - 0.2) / 0.5));
    for (let i = 0; i < this.litterCount; i += 1) {
      const o = i * 16;
      for (const c of [0, 1, 2, 4, 5, 6, 8, 9, 10]) litterArray[o + c] = this.litterBase[o + c] * litterK;
    }
    litter.instanceMatrix.needsUpdate = true;
    litter.count = litterK <= 0 ? 0 : this.litterCount;

    // Grass is buried and turns white.
    const grassArray = grass.instanceMatrix.array as Float32Array;
    const colours = grass.instanceColor!.array as Float32Array;
    for (let i = 0; i < this.grassDelay.length; i += 1) {
      const e = smooth(clamp01((t - this.grassDelay[i]) / (1 - GRASS_MAX_DELAY)));
      const o = i * 16;
      const squash = 1 - (1 - BURIED_GRASS) * e;
      for (const c of [4, 5, 6]) grassArray[o + c] = this.grassBase[o + c] * squash;
      const q = i * 3;
      for (let c = 0; c < 3; c += 1) colours[q + c] = snap.grass[q + c] + (this.grassTarget[q + c] - snap.grass[q + c]) * e;
    }
    grass.instanceMatrix.needsUpdate = true;
    grass.instanceColor!.needsUpdate = true;
    // Once buried the blades are gone, so no dark tips poke through the snow.
    grass.count = t >= 1 ? 0 : this.grassDelay.length;

    // Clumps swell up from nothing, ground first and branch piles a little later.
    const writeClumps = (mesh: THREE.InstancedMesh, offset: number, count: number) => {
      const array = mesh.instanceMatrix.array as Float32Array;
      for (let i = 0; i < count; i += 1) {
        const c = (offset + i) * 9;
        const e = easeOut(clamp01((t - this.clump[c + 8]) / (1 - CLUMP_MAX_DELAY)));
        const o = i * 16;
        const cos = this.clump[c + 6];
        const sin = this.clump[c + 7];
        array[o] = this.clump[c + 3] * e * cos;
        array[o + 1] = 0;
        array[o + 2] = -this.clump[c + 3] * e * sin;
        array[o + 3] = 0;
        array[o + 4] = 0;
        array[o + 5] = this.clump[c + 4] * e;
        array[o + 6] = 0;
        array[o + 7] = 0;
        array[o + 8] = this.clump[c + 5] * e * sin;
        array[o + 9] = 0;
        array[o + 10] = this.clump[c + 5] * e * cos;
        array[o + 11] = 0;
        array[o + 12] = this.clump[c];
        array[o + 13] = this.clump[c + 1];
        array[o + 14] = this.clump[c + 2];
        array[o + 15] = 1;
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    writeClumps(this.groundClumps, 0, GROUND_CLUMPS);
    this.writeBranchSnow(t);

    const capEase = easeOut(clamp01((t - 0.35) / 0.65));
    this.caps.forEach(({ mesh, radii }) => mesh.scale.set(radii[0] * capEase, radii[1] * capEase, radii[2] * capEase));

    this.snow.value = smooth(clamp01((t - 0.05) / 0.85));
    (this.flakes.material as THREE.PointsMaterial).opacity = 0.9 * smooth(clamp01(t * 2));

    // Atmosphere: pale, cool and bright.
    const e = smooth(t);
    const targets = this.targets;
    if (scene.fog) {
      const fog = scene.fog as THREE.FogExp2;
      fog.color.lerpColors(snap.fog, targets.fog, e);
      fog.density = snap.fogDensity + (0.02 - snap.fogDensity) * e;
    }
    renderer.setClearColor(this.scratch.lerpColors(snap.clear, targets.clear, e), 1);
    hemisphere.color.lerpColors(snap.sky, targets.sky, e);
    hemisphere.groundColor.lerpColors(snap.ground, targets.ground, e);
    hemisphere.intensity = snap.hemisphere + (1.7 - snap.hemisphere) * e;
    key.color.lerpColors(snap.key, targets.key, e);
    key.intensity = snap.keyIntensity + (2.6 - snap.keyIntensity) * e;
    rim.color.lerpColors(snap.rim, targets.rim, e);
    rim.intensity = snap.rimIntensity + (2.4 - snap.rimIntensity) * e;
    fill.color.lerpColors(snap.fill, targets.fill, e);
    fill.intensity = snap.fillIntensity + (0.95 - snap.fillIntensity) * e;
    renderer.toneMappingExposure = snap.exposure + (1.0 - snap.exposure) * e;
    this.parts.mountains.forEach((material, index) => {
      const target = MOUNTAIN_TARGETS[Math.min(index, MOUNTAIN_TARGETS.length - 1)];
      material.color.lerpColors(snap.mountains[index].color, this.scratch.set(target.color), e);
      material.opacity = snap.mountains[index].opacity + (target.opacity - snap.mountains[index].opacity) * e;
    });

    // The shadow map is only rendered on request: the crown is gone and the snow is new.
    renderer.shadowMap.needsUpdate = true;
  }
}
