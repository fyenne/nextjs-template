import * as THREE from "three";
import { SKY_LAYER, WORLD_LAYER } from "./night-sky";

/** Length of the whole sequence: a quick grow that swallows everything, then the shrink to the gold point. */
const BLACK_HOLE_DURATION_MS = 5500;
/** Converts the look's shadow fraction into Schwarzschild radii. */
const SHADOW_RADIUS_RS = 2.6;
/** Photon capture radius, 3 * sqrt(3) M, in Schwarzschild radii (rs = 2M): light closer than this is lost. */
const CAPTURE_RS = 1.3;
/** Inner edge of the accretion disk, in Schwarzschild radii. */
const DISK_INNER_RS = 2.6;
/** Light is bent step by step inside this radius; outside it the weak-field tail takes over. */
const TRACE_SHELL_RS = 16;
/** Shadow size as a fraction of screen height: a seed, a peak, then a collapse to a dot. */
const SHADOW_START = 0.004;
const SHADOW_END = 0.0035;
/** Swallowed sphere at the start, as a fraction of screen height. */
const EAT_SEED = 0.01;
/** Timeline as shares of the sequence: the swallow runs from SWALLOW_BEGIN to SWALLOW_DONE, the landscape is gone by GONE_AT, and the shrink starts then. */
const SWALLOW_BEGIN = 0.02;
const SWALLOW_DONE = 0.34;
const GONE_AT = 0.4;

export type BlackHolePalette = "gold" | "white" | "ember";

export type BlackHoleLook = {
  name: string;
  /** Shadow size at its peak, as a fraction of screen height. */
  shadowPeak: number;
  /** Swallowed sphere at the end of the swallow, as a fraction of screen height. */
  swallowEnd: number;
  /** Outer edge of the accretion disk, in Schwarzschild radii. */
  diskOuterRs: number;
  /** How strongly the picture is bent: 1 is full Schwarzschild bending, lower acts like a distorting mirror. */
  lensGain: number;
  /** How much the disk faces the camera at birth: 0 is edge-on, 1 is face-on. */
  diskFacing: number;
  diskGain: number;
  palette: BlackHolePalette;
  /** Width of the swallowed edge: 0 is hard, 1 is very soft. */
  eatSoftness: number;
  /** Inflow of the surface toward the hole near the swallowed edge. */
  pull: number;
  /** How hard the moon is pulled into a funnel around the hole, 0 to 1. */
  moonPull: number;
  /** How far the swallowed edge wobbles from a circle, as a fraction of its radius. */
  lobes: number;
};

export const BLACK_HOLE_LOOKS: BlackHoleLook[] = [
  {
    name: "A baseline",
    shadowPeak: 0.16,
    swallowEnd: 0.8,
    diskOuterRs: 6,
    lensGain: 0.45,
    diskFacing: 0.34,
    diskGain: 1,
    palette: "gold",
    eatSoftness: 0.1,
    moonPull: 0.7,
    lobes: 0.22,
    pull: 0,
  },
  {
    name: "B compact",
    shadowPeak: 0.07,
    swallowEnd: 0.7,
    diskOuterRs: 4.5,
    lensGain: 0.3,
    diskFacing: 0.3,
    diskGain: 1.2,
    palette: "gold",
    eatSoftness: 0.35,
    moonPull: 0.6,
    lobes: 0.18,
    pull: 0.3,
  },
  {
    name: "C thin ring",
    shadowPeak: 0.09,
    swallowEnd: 0.8,
    diskOuterRs: 5,
    lensGain: 0.8,
    diskFacing: 0.12,
    diskGain: 1.5,
    palette: "white",
    eatSoftness: 0.2,
    moonPull: 0.8,
    lobes: 0.28,
    pull: 0,
  },
  {
    name: "D ember pour",
    shadowPeak: 0.12,
    swallowEnd: 0.9,
    diskOuterRs: 7,
    lensGain: 0.6,
    diskFacing: 0.5,
    diskGain: 0.9,
    palette: "ember",
    eatSoftness: 0.5,
    moonPull: 0.75,
    lobes: 0.3,
    pull: 0.6,
  },
];

const PALETTES: Record<BlackHolePalette, [[number, number, number], [number, number, number], [number, number, number]]> = {
  gold: [
    [1.0, 0.95, 0.8],
    [1.0, 0.62, 0.2],
    [0.5, 0.13, 0.03],
  ],
  white: [
    [1.0, 1.0, 0.97],
    [1.0, 0.85, 0.55],
    [0.85, 0.35, 0.08],
  ],
  ember: [
    [1.0, 0.75, 0.4],
    [1.0, 0.3, 0.06],
    [0.45, 0.04, 0.01],
  ],
};

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D tWorld;
  uniform sampler2D tDepth;
  uniform sampler2D tSky;
  uniform vec3 uCamPos;
  uniform vec3 uCamRight;
  uniform vec3 uCamUp;
  uniform vec3 uCamFwd;
  uniform float uTanHalf;
  uniform float uAspect;
  uniform float uNear;
  uniform float uFar;
  uniform vec3 uHole;
  uniform vec2 uHoleUv;
  uniform float uRs;
  uniform float uEat;
  uniform float uEatP;
  uniform float uEatSoft;
  uniform float uPull;
  uniform vec3 uDiskN;
  uniform vec3 uDiskE1;
  uniform vec3 uDiskE2;
  uniform float uRIn;
  uniform float uROut;
  uniform float uDiskGain;
  uniform float uLensGain;
  uniform vec3 uPalHot;
  uniform vec3 uPalGold;
  uniform vec3 uPalEmber;
  uniform float uFade;
  uniform float uLobes;
  uniform float uExposure;
  uniform float uTime;
  varying vec2 vUv;

  const int MAX_STEPS = 64;
  const float SHELL = ${TRACE_SHELL_RS.toFixed(1)};
  const float CAPTURE_RS = ${CAPTURE_RS.toFixed(2)};

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float gasNoise(vec2 p) {
    return 0.55 * valueNoise(p) + 0.3 * valueNoise(p * 2.07 + 3.1) + 0.15 * valueNoise(p * 4.13 + 7.7);
  }

  vec3 filmic(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }

  vec3 viewDirection(vec2 uv) {
    vec2 ndc = uv * 2.0 - 1.0;
    return normalize(uCamFwd + (ndc.x * uAspect * uTanHalf) * uCamRight + (ndc.y * uTanHalf) * uCamUp);
  }

  // Screen uv and view depth of a world point.
  vec3 toScreen(vec3 q) {
    vec3 rel = q - uCamPos;
    float z = dot(rel, uCamFwd);
    float zs = max(z, 1e-4);
    vec2 ndc = vec2(dot(rel, uCamRight) / (zs * uTanHalf * uAspect), dot(rel, uCamUp) / (zs * uTanHalf));
    return vec3(ndc * 0.5 + 0.5, z);
  }

  // View depth of the visible surface at a screen position.
  float surfaceDepth(vec2 uv) {
    float zNdc = texture2D(tDepth, uv).r * 2.0 - 1.0;
    return 2.0 * uNear * uFar / (uFar + uNear - zNdc * (uFar - uNear));
  }

  // Direction change from p to infinity along a straight line in the weak field (Schwarzschild radii).
  vec3 tailDeflection(vec3 p, vec3 v) {
    float u = dot(p, v);
    vec3 q = p - v * u;
    float b2 = max(dot(q, q), 1e-6);
    float g = u * (2.0 * u * u + 3.0 * b2) / (2.0 * pow(u * u + b2, 1.5));
    return -(q / b2) * (1.0 - g);
  }

  void diskCrossing(vec3 pc, vec3 rd, out vec3 emit, out float alpha) {
    vec3 inPlane = pc - uDiskN * dot(pc, uDiskN);
    float R = length(inPlane);
    float x = clamp((R - uRIn) / (uROut - uRIn), 0.0, 1.0);
    float edge = smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.7, 1.0, x));
    float phi = atan(dot(inPlane, uDiskE2), dot(inPlane, uDiskE1));
    vec3 flow = normalize(cross(uDiskN, inPlane));
    float beam = pow(clamp(0.7 + 0.5 * dot(flow, -rd), 0.0, 1.5), 2.5);
    float ang = phi + uTime * 0.6 * pow(uRIn / R, 1.5);
    float streak = smoothstep(0.3, 0.8, gasNoise(vec2(cos(ang), sin(ang)) * 3.0 + vec2(log(R / uRIn) * 7.0, 0.0)));
    float fall = pow(uRIn / R, 2.4);
    vec3 tint = mix(mix(uPalHot, uPalGold, smoothstep(0.0, 0.35, x)), uPalEmber, smoothstep(0.4, 1.0, x));
    emit = tint * fall * edge * (0.3 + 0.7 * streak) * beam * 2.2 * uDiskGain;
    alpha = edge * (0.25 + 0.45 * streak);
  }

  void main() {
    vec3 rd = viewDirection(vUv);
    vec3 O = (uCamPos - uHole) / uRs;
    float tc = -dot(O, rd);
    vec3 cp = O + rd * tc;
    float b = length(cp);
    bool camOutside = dot(O, O) > SHELL * SHELL;
    bool enters = b < SHELL && (tc > 0.0 || !camOutside);
    bool passes = !enters && tc > 0.0;
    bool lensed = enters || passes;
    float entryAlong = enters && camOutside ? tc - sqrt(SHELL * SHELL - b * b) : 0.0;

    // A surface between the camera and the lens is drawn as it is. Gate is 0 there and 1 behind it.
    float gateAlong = max((enters ? entryAlong : tc) * uRs, 1e-4);
    float surfaceAlong = surfaceDepth(vUv) / max(dot(rd, uCamFwd), 1e-4);
    float gate = lensed ? smoothstep(0.6, 1.0, surfaceAlong / gateAlong) : 0.0;

    vec3 dirOut = rd;
    float absorbed = 0.0;
    vec3 lit = vec3(0.0);
    float transmit = 1.0;
    bool hitFound = false;
    vec2 hitUv = vUv;

    if (enters) {
      vec3 p = O + rd * entryAlong;
      vec3 v = normalize(rd + tailDeflection(O, rd) - tailDeflection(p, rd));
      vec3 pPrev = p;
      float fPrev = 0.0;
      bool havePrev = false;
      for (int i = 0; i < MAX_STEPS; i++) {
        float r = length(p);
        if (r < 1.0) {
          absorbed = 1.0;
          break;
        }
        if (r > SHELL && dot(p, v) > 0.0) break;
        float dt = clamp(0.12 * r, 0.03, 1.5);
        vec3 h = cross(p, v);
        vec3 accel = -1.5 * dot(h, h) * p / pow(r, 5.0);
        vec3 vn = normalize(v + accel * dt);
        vec3 pn = p + vn * dt;

        // A visible surface crossed by the bent path stops the light there.
        vec3 sc = toScreen(uHole + pn * uRs);
        bool onScreen = sc.z > 0.0 && all(greaterThanEqual(sc.xy, vec2(0.0))) && all(lessThanEqual(sc.xy, vec2(1.0)));
        if (onScreen) {
          float f = sc.z - surfaceDepth(sc.xy);
          if (havePrev && fPrev < 0.0 && f >= 0.0 && !hitFound) {
            vec3 pHit = mix(pPrev, pn, fPrev / (fPrev - f));
            vec2 uvHit = toScreen(uHole + pHit * uRs).xy;
            // The first solid surface sets the background here. The path keeps going, so the ring stays whole.
            if (texture2D(tWorld, uvHit).a > 0.5) {
              hitUv = uvHit;
              hitFound = true;
            }
          }
          fPrev = f;
          havePrev = true;
        } else {
          havePrev = false;
        }
        pPrev = pn;

        float s0 = dot(p, uDiskN);
        float s1 = dot(pn, uDiskN);
        if (s0 * s1 < 0.0) {
          vec3 pc = mix(p, pn, s0 / (s0 - s1));
          float R = length(pc - uDiskN * dot(pc, uDiskN));
          if (R > uRIn && R < uROut) {
            vec3 emit;
            float alpha;
            diskCrossing(pc, vn, emit, alpha);
            lit += transmit * emit;
            transmit *= 1.0 - alpha;
          }
        }
        p = pn;
        v = vn;
      }
      if (!hitFound && absorbed < 0.5) {
        dirOut = normalize(v + tailDeflection(p, v));
      }
    } else if (passes) {
      dirOut = normalize(rd + tailDeflection(O, rd));
    }

    // Scale the bending, so the picture warps like a mirror rather than folding out of frame.
    dirOut = normalize(rd + gate * uLensGain * (dirOut - rd));
    float blackness = absorbed * gate;

    // Inside the capture radius nothing escapes, so the black disc stays whole against any background.
    float inDisc = tc > 0.0 ? 1.0 - smoothstep(CAPTURE_RS - 0.03, CAPTURE_RS, b) : 0.0;
    float disc = inDisc;
    blackness = max(blackness, disc);
    lit *= 1.0 - disc;

    vec2 uvLens = vUv;
    bool worldVisible = true;
    if (hitFound) {
      uvLens = hitUv;
    } else if (lensed) {
      worldVisible = dot(dirOut, uCamFwd) > 0.05;
      if (worldVisible) uvLens = toScreen(uCamPos + dirOut * 100.0).xy;
    }

    vec3 world = vec3(0.0);
    float coverage = 0.0;
    if (worldVisible) {
      vec2 uv = uvLens;
      float rr = length((uv - uHoleUv) * vec2(uAspect, 1.0));
      float inflow = uPull * (1.0 - smoothstep(uEatP * 0.6, uEatP * 2.2, rr));
      uv = uHoleUv + (uv - uHoleUv) * (1.0 + 0.5 * inflow);
      if (all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
        vec4 w = texture2D(tWorld, uv);
        world = w.rgb;
        coverage = w.a;
        if (coverage > 0.002) {
          vec3 rw = viewDirection(uv);
          vec3 surface = uCamPos + rw * (surfaceDepth(uv) / max(dot(rw, uCamFwd), 1e-4));
          // The swallowed edge wobbles with angle around the hole, so it never reads as a clean circle.
          vec2 dq = (uv - uHoleUv) * vec2(uAspect, 1.0);
          float ang = atan(dq.y, dq.x + 1e-5);
          float edge = uEat * (1.0 + uLobes * (0.6 * sin(3.0 * ang + 2.0 * uTime) + 0.4 * sin(5.0 * ang - 1.3 * uTime)));
          float eaten = 1.0 - smoothstep(edge * (1.0 - uEatSoft), edge, length(surface - uHole));
          world = mix(world, vec3(0.0), eaten);
          coverage = mix(coverage, 1.0, eaten);
        }
      }
    }

    float fade = uFade;
    world *= fade;
    coverage *= fade;
    world *= 1.0 - blackness;
    coverage = mix(coverage, 1.0, blackness);

    vec3 sky = texture2D(tSky, vUv).rgb;
    vec3 color = filmic((lit + transmit * world) * uExposure) + sky * (1.0 - coverage) * transmit;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Three passes: the landscape and moon, with coverage kept in alpha; the sky on its own,
 * so the stars never move; then a composite that bends light around the hole. The disk,
 * the bending and the surface lookup all live in world space, so the lens holds from any
 * camera angle.
 */
export class BlackHoleEffect {
  private readonly worldDepth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  private readonly worldTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: true });
  private readonly skyTarget = new THREE.WebGLRenderTarget(1, 1, { samples: 4, depthBuffer: false });
  private readonly compositeScene = new THREE.Scene();
  private readonly compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  private readonly compositeGeometry = new THREE.PlaneGeometry(2, 2);
  private readonly compositeMaterial: THREE.ShaderMaterial;
  private readonly compositeQuad: THREE.Mesh;
  private readonly resolution = new THREE.Vector2(1, 1);
  private readonly contact = new THREE.Vector3();
  private readonly holeNdc = new THREE.Vector3();
  private readonly holeUv = new THREE.Vector2();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly diskNormal = new THREE.Vector3();
  private readonly diskAxisA = new THREE.Vector3();
  private readonly diskAxisB = new THREE.Vector3();
  private readonly clearColor = new THREE.Color();
  private look: BlackHoleLook = BLACK_HOLE_LOOKS[0];
  private diskReady = false;
  private startedAt: number | null = null;
  private durationMs = BLACK_HOLE_DURATION_MS;
  private currentProgress = 0;
  private currentCollapse = 0;

  constructor() {
    this.worldDepth.minFilter = THREE.NearestFilter;
    this.worldDepth.magFilter = THREE.NearestFilter;
    this.worldTarget.depthTexture = this.worldDepth;

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tWorld: { value: this.worldTarget.texture },
        tDepth: { value: this.worldDepth },
        tSky: { value: this.skyTarget.texture },
        uCamPos: { value: new THREE.Vector3() },
        uCamRight: { value: new THREE.Vector3() },
        uCamUp: { value: new THREE.Vector3() },
        uCamFwd: { value: new THREE.Vector3() },
        uTanHalf: { value: 0 },
        uAspect: { value: 1 },
        uNear: { value: 0.1 },
        uFar: { value: 500 },
        uHole: { value: new THREE.Vector3() },
        uHoleUv: { value: new THREE.Vector2() },
        uRs: { value: 1 },
        uEat: { value: 0 },
        uEatP: { value: 0 },
        uEatSoft: { value: 0 },
        uPull: { value: 0 },
        uDiskN: { value: new THREE.Vector3(0, 1, 0) },
        uDiskE1: { value: new THREE.Vector3(1, 0, 0) },
        uDiskE2: { value: new THREE.Vector3(0, 0, 1) },
        uRIn: { value: DISK_INNER_RS },
        uROut: { value: 6 },
        uDiskGain: { value: 1 },
        uLensGain: { value: 1 },
        uPalHot: { value: new THREE.Vector3(1, 0.95, 0.8) },
        uPalGold: { value: new THREE.Vector3(1, 0.62, 0.2) },
        uPalEmber: { value: new THREE.Vector3(0.5, 0.13, 0.03) },
        uFade: { value: 1 },
        uLobes: { value: 0 },
        uExposure: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    this.compositeQuad = new THREE.Mesh(this.compositeGeometry, this.compositeMaterial);
    this.compositeQuad.frustumCulled = false;
    this.compositeScene.add(this.compositeQuad);
    this.compositeCamera.position.z = 1;
  }

  get started() {
    return this.startedAt !== null;
  }

  get progress() {
    return this.currentProgress;
  }

  /** How far the moon is drawn into the funnel right now, from 0 to the look's moonPull. */
  get moonCollapse() {
    return this.currentCollapse * this.look.moonPull;
  }

  start(now: number, contact: THREE.Vector3, look: BlackHoleLook = BLACK_HOLE_LOOKS[0], reduceMotion = false) {
    if (this.started) return;
    this.startedAt = now;
    this.contact.copy(contact);
    this.look = look;
    this.durationMs = reduceMotion ? 0 : BLACK_HOLE_DURATION_MS;
    const [hot, gold, ember] = PALETTES[look.palette];
    const uniforms = this.compositeMaterial.uniforms;
    uniforms.uPalHot.value.set(...hot);
    uniforms.uPalGold.value.set(...gold);
    uniforms.uPalEmber.value.set(...ember);
    uniforms.uDiskGain.value = look.diskGain;
    uniforms.uLensGain.value = look.lensGain;
    uniforms.uROut.value = look.diskOuterRs;
    uniforms.uEatSoft.value = look.eatSoftness;
    uniforms.uPull.value = look.pull;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, now: number) {
    camera.layers.enableAll();
    if (this.startedAt === null) {
      renderer.render(scene, camera);
      return;
    }

    renderer.getDrawingBufferSize(this.resolution);
    const width = Math.max(1, Math.floor(this.resolution.x));
    const height = Math.max(1, Math.floor(this.resolution.y));
    if (this.worldTarget.width !== width || this.worldTarget.height !== height) {
      this.worldTarget.setSize(width, height);
      this.skyTarget.setSize(width, height);
    }

    camera.updateMatrixWorld(true);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    this.up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    this.forward.setFromMatrixColumn(camera.matrixWorld, 2).negate().normalize();
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    if (!this.diskReady) this.orientDisk(camera.position);

    const elapsed = Math.max(0, now - this.startedAt);
    const progress = this.durationMs === 0 ? 1 : THREE.MathUtils.clamp(elapsed / this.durationMs, 0, 1);
    this.currentProgress = progress;

    // World length of one screen-height unit at the hole's distance.
    const screenUnit = 2 * Math.max(0.01, this.contact.distanceTo(camera.position)) * tanHalf;
    const grow = THREE.MathUtils.smoothstep(progress, 0, GONE_AT);
    const swallow = THREE.MathUtils.smoothstep(progress, SWALLOW_BEGIN, SWALLOW_DONE);
    const collapse = THREE.MathUtils.smoothstep(progress, 0, SWALLOW_DONE);
    const fade = 1 - THREE.MathUtils.smoothstep(progress, SWALLOW_DONE, GONE_AT);
    const shrink = THREE.MathUtils.smoothstep(progress, GONE_AT, 1);
    const shadow = THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(SHADOW_START, this.look.shadowPeak, grow),
      SHADOW_END,
      shrink,
    );
    const eatP = THREE.MathUtils.lerp(EAT_SEED, this.look.swallowEnd, swallow);
    this.currentCollapse = collapse;
    this.holeNdc.copy(this.contact).project(camera);
    this.holeUv.set(this.holeNdc.x * 0.5 + 0.5, this.holeNdc.y * 0.5 + 0.5);

    const uniforms = this.compositeMaterial.uniforms;
    uniforms.uCamPos.value.copy(camera.position);
    uniforms.uCamRight.value.copy(this.right);
    uniforms.uCamUp.value.copy(this.up);
    uniforms.uCamFwd.value.copy(this.forward);
    uniforms.uTanHalf.value = tanHalf;
    uniforms.uAspect.value = width / height;
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    uniforms.uHole.value.copy(this.contact);
    uniforms.uHoleUv.value.copy(this.holeUv);
    uniforms.uRs.value = (shadow * screenUnit) / SHADOW_RADIUS_RS;
    uniforms.uEatP.value = eatP;
    uniforms.uEat.value = eatP * screenUnit;
    uniforms.uDiskN.value.copy(this.diskNormal);
    uniforms.uDiskE1.value.copy(this.diskAxisA);
    uniforms.uDiskE2.value.copy(this.diskAxisB);
    uniforms.uFade.value = fade;
    uniforms.uLobes.value = this.look.lobes * collapse;
    uniforms.uExposure.value = renderer.toneMappingExposure;
    uniforms.uTime.value = elapsed / 1000;

    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    const previousAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    try {
      renderer.autoClear = true;
      camera.layers.set(WORLD_LAYER);
      renderer.setRenderTarget(this.worldTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);

      camera.layers.set(SKY_LAYER);
      renderer.setRenderTarget(this.skyTarget);
      renderer.setClearColor(this.clearColor, previousAlpha);
      renderer.render(scene, camera);

      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.render(this.compositeScene, this.compositeCamera);
    } finally {
      camera.layers.enableAll();
      renderer.autoClear = previousAutoClear;
      renderer.setClearColor(this.clearColor, previousAlpha);
      renderer.setRenderTarget(previousTarget);
    }
  }

  /**
   * The disk is fixed in world space and tilted from the view at the moment of birth, so
   * it reads as a flattened ellipse at first and turns with the camera afterwards.
   */
  private orientDisk(cameraPosition: THREE.Vector3) {
    const facing = this.look.diskFacing;
    const toHole = new THREE.Vector3().subVectors(this.contact, cameraPosition).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const flatUp = worldUp.clone().addScaledVector(toHole, -worldUp.dot(toHole)).normalize();
    this.diskNormal.copy(flatUp).multiplyScalar(Math.sqrt(1 - facing * facing)).addScaledVector(toHole, facing).normalize();
    const helper = Math.abs(this.diskNormal.y) < 0.9 ? worldUp : new THREE.Vector3(1, 0, 0);
    this.diskAxisA.copy(helper).addScaledVector(this.diskNormal, -helper.dot(this.diskNormal)).normalize();
    this.diskAxisB.crossVectors(this.diskNormal, this.diskAxisA);
    this.diskReady = true;
  }

  dispose() {
    this.worldTarget.dispose();
    this.skyTarget.dispose();
    this.worldDepth.dispose();
    this.compositeGeometry.dispose();
    this.compositeMaterial.dispose();
  }
}
