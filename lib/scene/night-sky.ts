import * as THREE from "three";

export const NIGHT_GREETING_HOLD_MS = 5000;
export const NIGHT_TRANSITION_MS = 6500;

const SKY_LATITUDE = 40;
// A late-evening winter sky, with the celestial sphere rotated to frame Gemini above the tree.
const SKY_LOCAL_SIDEREAL_TIME = 5;
const SKY_AZIMUTH_ROTATION = 120;
const SKY_RADIUS = 182;
const CONSTELLATION_RADIUS = 179;
const STAR_RADIUS = 180;
const VISIBILITY_ALTITUDE = 1.5;
const GEMINI_MOON_HOVER_MS = 3000;
const GEMINI_STAR_FADE_MS = 160;
// A third of the previous 108s rise.
const MOON_RISE_MS = (5400 * 20) / 3;
const MOON_RADIUS_BEFORE = 3.35;
const MOON_DISTANCE_BEFORE = 46;
const MOON_END_Y_BEFORE = 22;
const MOON_RADIUS = MOON_RADIUS_BEFORE * 15;
// A 15× sphere at the old distance would swallow the camera. This distance keeps
// the same 15× growth in angular size and still leaves the camera outside.
const MOON_DISTANCE = MOON_RADIUS / Math.sin(Math.asin(MOON_RADIUS_BEFORE / MOON_DISTANCE_BEFORE) * 15);
const MOON_START_Y = 1.4;
const MOON_EXTRA_ELEVATION = (15 * Math.PI) / 180;

type PointFeature = {
  id: string | number;
  properties: { mag: number; bv?: string };
  geometry: { coordinates: [number, number] };
};

type LineFeature = {
  id: string;
  properties?: { rank?: string };
  geometry: { coordinates: [number, number][][] };
};

type NameFeature = {
  id: string;
  properties: { en?: string; name?: string };
};

type FeatureCollection<T> = { features: T[] };

type Catalog = {
  stars: FeatureCollection<PointFeature>;
  lines: FeatureCollection<LineFeature>;
  names: FeatureCollection<NameFeature>;
};

let catalogPromise: Promise<Catalog> | null = null;

type NightParts = {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  fog: THREE.FogExp2;
  hemisphere: THREE.HemisphereLight;
  ambient: THREE.AmbientLight;
  key: THREE.DirectionalLight;
  rim: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  monkLight: THREE.PointLight;
  mountains: THREE.MeshBasicMaterial[];
};

type NightSnapshot = {
  clear: THREE.Color;
  fog: THREE.Color;
  fogDensity: number;
  sky: THREE.Color;
  ground: THREE.Color;
  hemisphere: number;
  ambient: number;
  key: THREE.Color;
  keyIntensity: number;
  rim: THREE.Color;
  rimIntensity: number;
  fill: THREE.Color;
  fillIntensity: number;
  monk: number;
  exposure: number;
  mountains: { color: THREE.Color; opacity: number }[];
};

type HorizontalPosition = { direction: THREE.Vector3; altitude: number };
type ConstellationLine = {
  object: THREE.LineSegments;
  material: THREE.LineBasicMaterial;
  glowLine: THREE.LineSegments | null;
  name: string;
};
type GeminiJoint = { halo: THREE.PointsMaterial; core: THREE.PointsMaterial };
type FadingPoints = { material: THREE.PointsMaterial; opacity: number };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const radians = (degrees: number) => (degrees * Math.PI) / 180;

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** Equatorial coordinates into a fixed northern-hemisphere winter-night sky. */
export function equatorialToHorizontal(raDegrees: number, decDegrees: number): HorizontalPosition {
  const latitude = radians(SKY_LATITUDE);
  const declination = radians(decDegrees);
  const hourAngle = radians(SKY_LOCAL_SIDEREAL_TIME - raDegrees);
  const sinAltitude =
    Math.sin(declination) * Math.sin(latitude) +
    Math.cos(declination) * Math.cos(latitude) * Math.cos(hourAngle);
  const altitude = Math.asin(THREE.MathUtils.clamp(sinAltitude, -1, 1));
  const cosAltitude = Math.max(1e-6, Math.cos(altitude));
  const sinAzimuth = (-Math.cos(declination) * Math.sin(hourAngle)) / cosAltitude;
  const cosAzimuth =
    (Math.sin(declination) - Math.sin(altitude) * Math.sin(latitude)) /
    (cosAltitude * Math.cos(latitude));
  const azimuth = Math.atan2(sinAzimuth, cosAzimuth) + radians(SKY_AZIMUTH_ROTATION);
  return {
    direction: new THREE.Vector3(
      Math.sin(azimuth) * cosAltitude,
      Math.sin(altitude),
      Math.cos(azimuth) * cosAltitude,
    ),
    altitude,
  };
}

function galacticToEquatorial(longitudeDegrees: number, latitudeDegrees: number): [number, number] {
  const l = radians(longitudeDegrees);
  const b = radians(latitudeDegrees);
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(b) * Math.sin(l);
  const z = Math.sin(b);

  // Transpose of the ICRS-to-galactic rotation matrix.
  const ex = -0.0548755604 * x + 0.4941094279 * y - 0.8676661490 * z;
  const ey = -0.8734370902 * x - 0.4448296300 * y - 0.1980763734 * z;
  const ez = -0.4838350155 * x + 0.7469822445 * y + 0.4559837762 * z;
  return [((Math.atan2(ey, ex) / (Math.PI * 2)) * 360 + 360) % 360, (Math.asin(ez) / Math.PI) * 180];
}

function starColor(colorIndex: number) {
  const blue = new THREE.Color("#a9c5ff");
  const white = new THREE.Color("#f7f5ff");
  const amber = new THREE.Color("#ffd1a0");
  if (colorIndex < 0.25) return blue.clone().lerp(white, clamp01((colorIndex + 0.35) / 0.6));
  return white.clone().lerp(amber, clamp01((colorIndex - 0.25) / 1.4));
}

function softStarTexture() {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const alpha = Math.pow(clamp01(1 - d), 2.0);
      const offset = (y * size + x) * 4;
      pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Failed to load sky data ${path}: ${response.status}`);
  return (await response.json()) as T;
}

function normalizedName(name: string) {
  return name.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function makePointCloud(
  positions: number[],
  colors: number[],
  texture: THREE.Texture,
  size: number,
  opacity: number,
  renderOrder: number,
) {
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    sizeAttenuation: false,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    alphaTest: 0.02,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = renderOrder;
  return points;
}

function makeMilkyWayMaterial(galacticNorth: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNight: { value: 0 },
      uGalacticNorth: { value: galacticNorth },
    },
    vertexShader: `
      varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uNight;
      uniform vec3 uGalacticNorth;
      varying vec3 vSkyDirection;

      float hash31(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      float valueNoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash31(i);
        float n100 = hash31(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash31(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash31(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash31(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash31(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash31(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash31(i + vec3(1.0, 1.0, 1.0));
        return mix(
          mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
          mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
          f.z
        );
      }

      void main() {
        vec3 dir = normalize(vSkyDirection);
        float galacticLatitude = asin(clamp(dot(dir, normalize(uGalacticNorth)), -1.0, 1.0));
        float broadBand = exp(-0.5 * pow(galacticLatitude / 0.24, 2.0));
        float cloud = valueNoise(dir * 42.0) * 0.55 + valueNoise(dir * 95.0) * 0.3 + valueNoise(dir * 180.0) * 0.15;
        float darkLane = exp(-0.5 * pow((galacticLatitude - 0.015) / 0.035, 2.0));
        float intensity = broadBand * (0.2 + cloud * 0.5) * (1.0 - darkLane * 0.34);
        float alpha = uNight * intensity * 0.96;
        vec3 color = mix(vec3(0.13, 0.17, 0.34), vec3(0.38, 0.44, 0.68), cloud);
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
}

/** The stick-figure vertices are the stars the lines join. Smoothed samples in between are not. */
function constellationStarPositions(feature: LineFeature, radius: number) {
  const unique = new Map<string, [number, number, number]>();
  feature.geometry.coordinates.forEach((polyline) => {
    polyline.forEach(([ra, dec]) => {
      const point = equatorialToHorizontal(ra, dec);
      if (point.altitude < radians(VISIBILITY_ALTITUDE)) return;
      unique.set(`${ra.toFixed(4)},${dec.toFixed(4)}`, [
        point.direction.x * radius,
        point.direction.y * radius,
        point.direction.z * radius,
      ]);
    });
  });
  return Array.from(unique.values());
}

function buildConstellationPositions(feature: LineFeature, radius: number) {
  const positions: number[] = [];
  feature.geometry.coordinates.forEach((polyline) => {
    for (let i = 1; i < polyline.length; i += 1) {
      const [ra0, dec0] = polyline[i - 1];
      let [ra1, dec1] = polyline[i];
      while (ra1 - ra0 > 180) ra1 -= 360;
      while (ra1 - ra0 < -180) ra1 += 360;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(ra1 - ra0), Math.abs(dec1 - dec0)) / 2.5));
      let previous = equatorialToHorizontal(ra0, dec0);
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        const next = equatorialToHorizontal(ra0 + (ra1 - ra0) * t, dec0 + (dec1 - dec0) * t);
        if (previous.altitude >= radians(VISIBILITY_ALTITUDE) && next.altitude >= radians(VISIBILITY_ALTITUDE)) {
          positions.push(
            previous.direction.x * radius,
            previous.direction.y * radius,
            previous.direction.z * radius,
            next.direction.x * radius,
            next.direction.y * radius,
            next.direction.z * radius,
          );
        }
        previous = next;
      }
    }
  });
  return positions;
}

export async function createNightSky(parts: NightParts) {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      loadJson<FeatureCollection<PointFeature>>("/sky/stars.6.json"),
      loadJson<FeatureCollection<LineFeature>>("/sky/constellations.lines.json"),
      loadJson<FeatureCollection<NameFeature>>("/sky/constellations.json"),
    ])
      .then(([stars, lines, names]) => ({ stars, lines, names }))
      .catch((error: unknown) => {
        catalogPromise = null;
        throw error;
      });
  }
  const { stars, lines, names } = await catalogPromise;
  return new NightSky(parts, stars, lines, names);
}

export class NightSky {
  readonly root = new THREE.Group();
  readonly moon: THREE.DirectionalLight;
  readonly pointsTexture: THREE.Texture;

  private readonly risenMoon: THREE.Group;
  private readonly risenLight: THREE.DirectionalLight;
  private readonly moonMap: THREE.Texture;
  private geminiHoverSince: number | null = null;
  private geminiJoints: GeminiJoint[] = [];
  private moonRiseAt: number | null = null;
  private moonIsUp = false;
  private readonly moonBack = new THREE.Vector3();
  private readonly moonAnchor = new THREE.Vector3();
  private readonly moonLook = new THREE.Vector3();
  private moonEyeY = 0;
  private moonEndY = MOON_END_Y_BEFORE;

  private readonly raycaster = new THREE.Raycaster();
  private readonly lines: ConstellationLine[] = [];
  private readonly pointMaterials: FadingPoints[] = [];
  private readonly nightMaterial: THREE.MeshBasicMaterial;
  private readonly galaxyMaterial: THREE.ShaderMaterial;
  private startedAt: number | null = null;
  private progress = 0;
  private hovered: string | null = null;
  private snapshot: NightSnapshot | null = null;

  constructor(
    private readonly parts: NightParts,
    stars: FeatureCollection<PointFeature>,
    lines: FeatureCollection<LineFeature>,
    names: FeatureCollection<NameFeature>,
  ) {
    this.root.name = "Night sky";
    this.root.frustumCulled = false;
    parts.scene.add(this.root);

    this.nightMaterial = new THREE.MeshBasicMaterial({
      color: "#02040d",
      side: THREE.BackSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    const nightDome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 32), this.nightMaterial);
    nightDome.frustumCulled = false;
    nightDome.renderOrder = 8;
    this.root.add(nightDome);

    const northPole = equatorialToHorizontal(192.85948, 27.12825).direction;
    this.galaxyMaterial = makeMilkyWayMaterial(northPole);
    const galaxy = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS - 1, 64, 40), this.galaxyMaterial);
    galaxy.frustumCulled = false;
    galaxy.renderOrder = 9;
    this.root.add(galaxy);

    this.pointsTexture = softStarTexture();
    const dimPositions: number[] = [];
    const dimColors: number[] = [];
    const brightPositions: number[] = [];
    const brightColors: number[] = [];
    stars.features.forEach((star) => {
      const magnitude = star.properties.mag;
      if (!Number.isFinite(magnitude) || magnitude > 6.0) return;
      const [ra, dec] = star.geometry.coordinates;
      const point = equatorialToHorizontal(ra, dec);
      if (point.altitude < radians(-1)) return;
      const positions = magnitude <= 2.5 ? brightPositions : dimPositions;
      const colors = magnitude <= 2.5 ? brightColors : dimColors;
      const colorIndex = Number.parseFloat(star.properties.bv ?? "0.5");
      const color = starColor(Number.isFinite(colorIndex) ? colorIndex : 0.5);
      positions.push(point.direction.x * STAR_RADIUS, point.direction.y * STAR_RADIUS, point.direction.z * STAR_RADIUS);
      colors.push(color.r, color.g, color.b);
    });
    const dimPoints = makePointCloud(dimPositions, dimColors, this.pointsTexture, 1.6, 0.92, 11);
    const brightPoints = makePointCloud(brightPositions, brightColors, this.pointsTexture, 3.2, 1, 12);
    if (dimPoints) {
      this.root.add(dimPoints);
      this.pointMaterials.push({ material: dimPoints.material as THREE.PointsMaterial, opacity: 0.78 });
    }
    if (brightPoints) {
      this.root.add(brightPoints);
      this.pointMaterials.push({ material: brightPoints.material as THREE.PointsMaterial, opacity: 0.95 });
    }

    this.addMilkyWayDust();
    this.addConstellations(lines, names);
    this.addConstellationStars(lines);

    this.moon = new THREE.DirectionalLight("#b5caff", 0);
    this.moon.position.set(-24, 55, 14);
    this.moon.target.position.set(0, 5, 0);
    this.moon.castShadow = false;
    this.root.add(this.moon, this.moon.target);

    // NASA SVS 4720 color map on a smooth sphere. The map's 0° longitude
    // (near side) lands on the sphere's local +X.
    this.moonMap = new THREE.TextureLoader().load("/sky/lroc_color_2k.jpg");
    this.moonMap.colorSpace = THREE.SRGBColorSpace;
    this.moonMap.anisotropy = Math.min(8, parts.renderer.capabilities.getMaxAnisotropy());
    const moonBody = new THREE.Mesh(
      new THREE.SphereGeometry(MOON_RADIUS, 128, 96),
      new THREE.MeshBasicMaterial({
        map: this.moonMap,
        fog: false,
        toneMapped: false,
        // Opaque meshes all draw before transparent ones, and renderOrder cannot
        // change that. The mountain cards are transparent, so the disc has to
        // join that queue to cover them.
        transparent: true,
        opacity: 1,
        depthWrite: true,
      }),
    );
    moonBody.rotation.y = -Math.PI / 2;
    moonBody.castShadow = false;
    moonBody.receiveShadow = false;
    // The shan-shui ridges are vertical cards around the garden. This disc is
    // large enough to sit inside those rings, and the cards were blending a
    // dark band across the lower limb. Draw it after the ridges (order 0) and
    // before the night dome (order 8). Depth still keeps the ground and the
    // tree in front. Snow and fire stay above this, at order 2 and 3.
    moonBody.renderOrder = 1;
    this.risenMoon = new THREE.Group();
    this.risenMoon.name = "Risen moon";
    this.risenMoon.add(moonBody);
    this.risenMoon.visible = false;
    this.root.add(this.risenMoon);

    this.risenLight = new THREE.DirectionalLight("#e4ecff", 0);
    this.risenLight.castShadow = false;
    this.risenLight.shadow.mapSize.set(2048, 2048);
    this.risenLight.shadow.bias = -0.00045;
    this.risenLight.shadow.normalBias = 0.03;
    const shadowCamera = this.risenLight.shadow.camera as THREE.OrthographicCamera;
    shadowCamera.left = -28;
    shadowCamera.right = 28;
    shadowCamera.top = 28;
    shadowCamera.bottom = -28;
    shadowCamera.near = 8;
    shadowCamera.far = 280;
    shadowCamera.updateProjectionMatrix();
    this.risenLight.target.position.set(0, 0.4, 0);
    this.root.add(this.risenLight, this.risenLight.target);
  }

  get nightLevel() {
    return this.progress;
  }

  /** True once the risen moon has finished its climb. */
  get moonFullyUp() {
    return this.moonIsUp;
  }

  /** World position of the risen moon's center. The sphere is centered on the group. */
  moonCenter(target: THREE.Vector3) {
    if (!this.moonIsUp) return false;
    this.risenMoon.getWorldPosition(target);
    return true;
  }

  private addMilkyWayDust() {
    const random = seeded(20261111);
    const positions: number[] = [];
    const colors: number[] = [];
    for (let i = 0; i < 14000; i += 1) {
      const longitude = random() * 360;
      const latitude = ((random() + random() + random()) / 3 - 0.5) * 31;
      const [ra, dec] = galacticToEquatorial(longitude, latitude);
      const point = equatorialToHorizontal(ra, dec);
      if (point.altitude < radians(-2)) continue;
      const color = random() > 0.72 ? new THREE.Color("#c1c9ff") : new THREE.Color("#aeb6dc");
      const dim = 0.55 + random() * 0.4;
      positions.push(point.direction.x * (STAR_RADIUS - 1), point.direction.y * (STAR_RADIUS - 1), point.direction.z * (STAR_RADIUS - 1));
      colors.push(color.r * dim, color.g * dim, color.b * dim);
    }
    const dust = makePointCloud(positions, colors, this.pointsTexture, 2.3, 0.32, 10);
    if (dust) {
      this.root.add(dust);
      this.pointMaterials.push({ material: dust.material as THREE.PointsMaterial, opacity: 0.26 });
    }
  }

  /** A star at every stick-figure joint, for every drawn constellation. Gemini's green glow stays separate. */
  private addConstellationStars(lines: FeatureCollection<LineFeature>) {
    const unique = new Map<string, [number, number, number]>();
    lines.features.forEach((feature) => {
      if (Number(feature.properties?.rank ?? "3") > 2) return;
      const drawn = buildConstellationPositions(feature, CONSTELLATION_RADIUS);
      if (drawn.length < 6) return;
      constellationStarPositions(feature, CONSTELLATION_RADIUS).forEach((position) => {
        unique.set(position.map((value) => value.toFixed(2)).join(","), position);
      });
    });
    const positions = Array.from(unique.values()).flat();
    if (positions.length === 0) return;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const shared = {
      sizeAttenuation: false,
      map: this.pointsTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      alphaTest: 0.01,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    } as const;
    const halo = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ ...shared, color: "#d5e4ff", size: 13 }),
    );
    const core = new THREE.Points(
      geometry.clone(),
      new THREE.PointsMaterial({ ...shared, color: "#f7fbff", size: 3.8 }),
    );
    halo.name = "Constellation stars";
    core.name = "Constellation star cores";
    halo.frustumCulled = false;
    core.frustumCulled = false;
    halo.renderOrder = 14;
    core.renderOrder = 15;
    this.root.add(halo, core);
    this.pointMaterials.push(
      { material: halo.material as THREE.PointsMaterial, opacity: 0.72 },
      { material: core.material as THREE.PointsMaterial, opacity: 1 },
    );
  }

  private addConstellations(
    lines: FeatureCollection<LineFeature>,
    names: FeatureCollection<NameFeature>,
  ) {
    const namesById = new Map(
      names.features.map((feature) => [feature.id, normalizedName(feature.properties.name ?? feature.properties.en ?? feature.id)]),
    );
    lines.features.forEach((feature) => {
      // The IAU stick-figure source ranks major patterns 1 and 2. Rank 3 contains
      // dozens of small, dense figures that obscure the Milky Way when shown together.
      if (Number(feature.properties?.rank ?? "3") > 2) return;
      const positions = buildConstellationPositions(feature, CONSTELLATION_RADIUS);
      if (positions.length < 6) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere();
      const material = new THREE.LineBasicMaterial({
        color: "#8da9d1",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      });
      const object = new THREE.LineSegments(geometry, material);
      object.name = namesById.get(feature.id) ?? feature.id;
      object.userData.constellationName = object.name;
      object.renderOrder = 13;
      this.root.add(object);

      let glowLine: THREE.LineSegments | null = null;
      if (object.name === "Gemini") {
        const glowLineMaterial = new THREE.LineBasicMaterial({
          color: "#43ff8b",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
          toneMapped: false,
        });
        glowLine = new THREE.LineSegments(geometry.clone(), glowLineMaterial);
        glowLine.renderOrder = 14;
        this.root.add(glowLine);

        // Glow only the actual catalogued Gemini stars, not the extra points used
        // to smooth the constellation lines between them.
        // Catalog order walks the main chain, then the short branch. Each joint
        // gets its own material so the hover can light them one at a time.
        const uniquePositions = new Map<string, [number, number, number]>();
        feature.geometry.coordinates.forEach((polyline) => {
          polyline.forEach(([ra, dec]) => {
            const point = equatorialToHorizontal(ra, dec);
            if (point.altitude < radians(VISIBILITY_ALTITUDE)) return;
            const world: [number, number, number] = [
              point.direction.x * STAR_RADIUS,
              point.direction.y * STAR_RADIUS,
              point.direction.z * STAR_RADIUS,
            ];
            uniquePositions.set(`${ra.toFixed(4)},${dec.toFixed(4)}`, world);
          });
        });
        uniquePositions.forEach((position) => {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
          const shared = {
            sizeAttenuation: false,
            map: this.pointsTexture,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            alphaTest: 0.01,
            blending: THREE.AdditiveBlending,
            fog: false,
            toneMapped: false,
          } as const;
          const haloMaterial = new THREE.PointsMaterial({ ...shared, color: "#43ff8b", size: 22 });
          const coreMaterial = new THREE.PointsMaterial({ ...shared, color: "#e5ffef", size: 4.5 });
          const halo = new THREE.Points(geometry, haloMaterial);
          const core = new THREE.Points(geometry.clone(), coreMaterial);
          halo.frustumCulled = false;
          core.frustumCulled = false;
          halo.renderOrder = 15;
          core.renderOrder = 16;
          this.root.add(halo, core);
          this.geminiJoints.push({ halo: haloMaterial, core: coreMaterial });
        });
      }

      this.lines.push({ object, material, glowLine, name: object.name });
    });
  }

  start(now: number) {
    if (this.startedAt !== null) return;
    const { renderer, fog, hemisphere, ambient, key, rim, fill, monkLight } = this.parts;
    this.snapshot = {
      clear: renderer.getClearColor(new THREE.Color()),
      fog: fog.color.clone(),
      fogDensity: fog.density,
      sky: hemisphere.color.clone(),
      ground: hemisphere.groundColor.clone(),
      hemisphere: hemisphere.intensity,
      ambient: ambient.intensity,
      key: key.color.clone(),
      keyIntensity: key.intensity,
      rim: rim.color.clone(),
      rimIntensity: rim.intensity,
      fill: fill.color.clone(),
      fillIntensity: fill.intensity,
      monk: monkLight.intensity,
      exposure: renderer.toneMappingExposure,
      mountains: this.parts.mountains.map((material) => ({
        color: material.color.clone(),
        opacity: material.opacity,
      })),
    };
    this.startedAt = now;
  }

  update(now: number, camera?: THREE.Camera) {
    if (this.startedAt === null) return;
    const t = clamp01((now - this.startedAt) / NIGHT_TRANSITION_MS);
    this.progress = smoothstep(t);
    const e = this.progress;
    const snap = this.snapshot!;
    const { renderer, fog, hemisphere, ambient, key, rim, fill, monkLight, mountains } = this.parts;
    const color = new THREE.Color();

    renderer.setClearColor(color.lerpColors(snap.clear, new THREE.Color("#030611"), e), 1);
    fog.color.lerpColors(snap.fog, new THREE.Color("#0a1020"), e);
    fog.density = snap.fogDensity + (0.024 - snap.fogDensity) * e;
    hemisphere.color.lerpColors(snap.sky, new THREE.Color("#26395f"), e);
    hemisphere.groundColor.lerpColors(snap.ground, new THREE.Color("#090d18"), e);
    hemisphere.intensity = snap.hemisphere + (0.78 - snap.hemisphere) * e;
    ambient.intensity = snap.ambient + (0.3 - snap.ambient) * e;
    key.color.lerpColors(snap.key, new THREE.Color("#b1c6ff"), e);
    key.intensity = snap.keyIntensity + (0.28 - snap.keyIntensity) * e;
    rim.color.lerpColors(snap.rim, new THREE.Color("#91a9e1"), e);
    rim.intensity = snap.rimIntensity + (0.75 - snap.rimIntensity) * e;
    fill.color.lerpColors(snap.fill, new THREE.Color("#7386bc"), e);
    fill.intensity = snap.fillIntensity + (0.3 - snap.fillIntensity) * e;
    monkLight.intensity = snap.monk + (3.2 - snap.monk) * e;
    renderer.toneMappingExposure = snap.exposure + (1.0 - snap.exposure) * e;

    mountains.forEach((material, index) => {
      const source = snap.mountains[index];
      material.color.lerpColors(source.color, new THREE.Color("#121a2d"), e);
      material.opacity = source.opacity + (0.56 - source.opacity) * e;
    });

    this.nightMaterial.opacity = e;
    this.galaxyMaterial.uniforms.uNight.value = e;
    this.pointMaterials.forEach(({ material, opacity }) => {
      material.opacity = e * opacity;
    });
    this.lines.forEach(({ material, name }) => {
      material.opacity = e * (name === this.hovered ? 0.96 : 0.24);
      if (name === this.hovered && name !== "Gemini") material.color.set("#c9dcff");
      else if (name === "Gemini" && name === this.hovered) material.color.set("#43ff8b");
      else material.color.set("#8da9d1");
    });
    this.updateGeminiGlow(now);
    const rise = this.stepRisenMoon(now, camera);
    this.moon.intensity = e * 2.0 * (1 - rise * 0.8);
    if (t >= 1 && e === 1) renderer.shadowMap.needsUpdate = true;
  }

  /**
   * After Gemini has been hovered for 3 seconds, the moon rises behind the
   * camera and shines toward the garden, so its shadow falls across the floor
   * in the direction the camera is looking.
   */
  private stepRisenMoon(now: number, camera?: THREE.Camera) {
    if (this.moonRiseAt === null) {
      if (
        !camera ||
        this.geminiHoverSince === null ||
        now - this.geminiHoverSince < GEMINI_MOON_HOVER_MS
      ) {
        return 0;
      }
      camera.getWorldDirection(this.moonLook);
      this.moonLook.y = 0;
      if (this.moonLook.lengthSq() < 1e-8) return 0;
      this.moonLook.normalize();
      // getWorldDirection is where the camera looks. Behind it is the opposite.
      this.moonBack.copy(this.moonLook).negate();
      this.moonAnchor.set(camera.position.x, 0, camera.position.z);
      this.moonEyeY = camera.position.y;
      const previousElevation = Math.atan2(MOON_END_Y_BEFORE - this.moonEyeY, MOON_DISTANCE_BEFORE);
      const raised =
        this.moonEyeY + Math.tan(previousElevation + MOON_EXTRA_ELEVATION) * MOON_DISTANCE;
      // At 15× size that height still plants the sphere in the ground and slices the limb.
      // Keep the +15° and lift only as far as a round disc above the snow.
      this.moonEndY = Math.max(raised, MOON_RADIUS + 1.5);
      this.moonRiseAt = now;
      this.geminiHoverSince = null;
      this.risenMoon.visible = true;
      this.risenLight.castShadow = true;
    }

    const t = clamp01((now - this.moonRiseAt) / MOON_RISE_MS);
    const ease = smoothstep(t);
    if (ease >= 1) this.moonIsUp = true;
    const y = MOON_START_Y + (this.moonEndY - MOON_START_Y) * ease;
    this.risenMoon.position.set(
      this.moonAnchor.x + this.moonBack.x * MOON_DISTANCE,
      y,
      this.moonAnchor.z + this.moonBack.z * MOON_DISTANCE,
    );
    this.risenMoon.lookAt(0, y, 0);
    this.risenLight.position.copy(this.risenMoon.position);
    this.risenLight.target.position.set(0, 0.4, 0);
    this.risenLight.intensity = ease * 3.6;
    return ease;
  }

  setHovered(name: string | null) {
    if (name === "Gemini") {
      if (this.geminiHoverSince === null && this.moonRiseAt === null) this.geminiHoverSince = performance.now();
    } else if (this.moonRiseAt === null) {
      this.geminiHoverSince = null;
    }
    this.hovered = name;
    const level = this.progress;
    this.lines.forEach(({ material, name: lineName }) => {
      const active = name !== null && lineName === name;
      material.opacity = level * (active ? 0.96 : 0.24);
      material.color.set(active ? (lineName === "Gemini" ? "#43ff8b" : "#c9dcff") : "#8da9d1");
    });
    this.updateGeminiGlow();
  }

  private updateGeminiGlow(now = performance.now()) {
    const hovering = this.hovered === "Gemini";
    const count = this.geminiJoints.length;
    const span = Math.max(0, GEMINI_MOON_HOVER_MS - GEMINI_STAR_FADE_MS);
    const step = count > 1 ? span / (count - 1) : 0;
    const elapsed =
      !hovering || this.geminiHoverSince === null
        ? this.moonRiseAt !== null && hovering
          ? GEMINI_MOON_HOVER_MS
          : 0
        : now - this.geminiHoverSince;
    this.geminiJoints.forEach((joint, index) => {
      const lit = hovering ? clamp01((elapsed - index * step) / GEMINI_STAR_FADE_MS) : 0;
      joint.halo.opacity = lit * this.progress * 0.78;
      joint.core.opacity = lit * this.progress * 0.95;
    });
    const lineOpacity = hovering ? this.progress * 0.94 : 0;
    this.lines.forEach(({ glowLine }) => {
      if (!glowLine) return;
      (glowLine.material as THREE.LineBasicMaterial).opacity = lineOpacity;
    });
  }

  pick(camera: THREE.Camera, ndc: THREE.Vector2) {
    if (this.progress < 0.25) return null;
    this.raycaster.params.Line.threshold = 1.8;
    this.raycaster.setFromCamera(ndc, camera);
    this.root.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(this.lines.map((line) => line.object), false);
    return (hits[0]?.object.userData.constellationName as string | undefined) ?? null;
  }

  dispose() {
    this.root.removeFromParent();
    this.root.traverse((object) => {
      const renderable = object as THREE.Mesh;
      renderable.geometry?.dispose();
      const material = renderable.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material?.dispose();
    });
    this.pointsTexture.dispose();
    this.moonMap.dispose();
  }
}
