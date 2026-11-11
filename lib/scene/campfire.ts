import * as THREE from "three";

/**
 * Campfire for the winter clearing.
 * The group is left unrotated: cones point along local +Y, which is world up.
 * The caller places the group in front of the monk. Flames pivot at their base.
 */

export type Campfire = {
  group: THREE.Group;
  update: (seconds: number) => void;
  /** Each fed branch: the whole fire, including its light, grows by half, up to 4× its starting size. */
  grow: () => void;
  /** True once the fire has reached that 4× cap. */
  readonly atMaximum: boolean;
  dispose: () => void;
};

type Flame = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  phase: number;
};

type Ember = {
  mesh: THREE.Mesh;
  baseX: number;
  baseZ: number;
  phase: number;
  speed: number;
};

const FLAMES: { x: number; z: number; height: number; radius: number; base: number; tip: number; opacity: number }[] = [
  { x: 0.0, z: 0.02, height: 1.12, radius: 0.1, base: 0xfff6d2, tip: 0xffb13a, opacity: 0.96 },
  { x: 0.07, z: -0.04, height: 0.9, radius: 0.08, base: 0xffe7a8, tip: 0xff6a1a, opacity: 0.92 },
  { x: -0.06, z: 0.05, height: 0.98, radius: 0.09, base: 0xfff0c0, tip: 0xff7c28, opacity: 0.92 },
  { x: 0.03, z: -0.07, height: 0.72, radius: 0.15, base: 0xffb45a, tip: 0xff3d0c, opacity: 0.8 },
  { x: -0.09, z: -0.01, height: 0.6, radius: 0.13, base: 0xff9a40, tip: 0xe02e08, opacity: 0.74 },
  { x: 0.1, z: 0.05, height: 0.66, radius: 0.11, base: 0xffc56e, tip: 0xff4a12, opacity: 0.76 },
  { x: -0.02, z: 0.09, height: 0.5, radius: 0.16, base: 0xff8a32, tip: 0xd42606, opacity: 0.68 },
];

function glowTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.pow(Math.max(0, 1 - d), 2.2);
      const o = (y * size + x) * 4;
      data[o] = 255;
      data[o + 1] = 150;
      data[o + 2] = 70;
      data[o + 3] = Math.round(a * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function flameGeometry(radius: number, height: number, baseHex: number, tipHex: number) {
  const geometry = new THREE.ConeGeometry(radius, height, 9, 6, true);
  // ConeGeometry is centered. Move the base to y = 0 so rotation pivots in the logs.
  geometry.translate(0, height / 2, 0);
  const position = geometry.getAttribute("position");
  const color = new Float32Array(position.count * 3);
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const scratch = new THREE.Color();
  for (let i = 0; i < position.count; i += 1) {
    const lift = THREE.MathUtils.clamp(position.getY(i) / height, 0, 1);
    scratch.copy(base).lerp(tip, Math.pow(lift, 0.65));
    color[i * 3] = scratch.r;
    color[i * 3 + 1] = scratch.g;
    color[i * 3 + 2] = scratch.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(color, 3));
  return geometry;
}

function flameMaterial(phase: number, height: number, opacity: number) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  material.customProgramCacheKey = () => `campfire-${phase.toFixed(3)}-${height.toFixed(3)}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    material.userData.shader = shader;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform float uTime;
         const float uPhase = ${phase.toFixed(4)};
         const float uHeight = ${height.toFixed(4)};`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         float tip = clamp(position.y / uHeight, 0.0, 1.0);
         float sway = tip * tip;
         transformed.x += sin(uTime * 6.8 + uPhase + tip * 4.6) * (0.04 + 0.24 * sway);
         transformed.z += cos(uTime * 5.2 + uPhase * 1.4 + tip * 3.6) * (0.03 + 0.2 * sway);
         transformed.x += sin(uTime * 15.0 + tip * 8.0 + uPhase) * 0.045 * tip;`,
      );
  };
  return material;
}

export function createCampfire(): Campfire {
  const group = new THREE.Group();

  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 1 }),
  );
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.02;
  ash.receiveShadow = true;
  group.add(ash);

  const stoneMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1, flatShading: true });
  const stoneGeometry = new THREE.DodecahedronGeometry(0.12, 0);
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2 + 0.15;
    const radius = 0.46 + (i % 3) * 0.025;
    const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
    stone.position.set(Math.cos(angle) * radius, 0.07, Math.sin(angle) * radius);
    stone.scale.set(0.85 + (i % 4) * 0.12, 0.55 + (i % 3) * 0.12, 0.9 + (i % 5) * 0.08);
    stone.rotation.set(i * 0.4, i * 0.7, i * 0.2);
    stone.castShadow = true;
    stone.receiveShadow = true;
    group.add(stone);
  }

  const logMaterial = new THREE.MeshStandardMaterial({ color: 0x2c1a10, roughness: 1 });
  const charMaterial = new THREE.MeshStandardMaterial({ color: 0x1a100c, roughness: 1 });
  const logGeometry = new THREE.CylinderGeometry(0.07, 0.085, 0.78, 7);
  const logs: { y: number; rotY: number; x: number; z: number; material: THREE.Material }[] = [
    { y: 0.09, rotY: 0.18, x: 0, z: -0.1, material: logMaterial },
    { y: 0.09, rotY: 0.18, x: 0, z: 0.1, material: logMaterial },
    { y: 0.2, rotY: Math.PI / 2 + 0.12, x: -0.1, z: 0, material: charMaterial },
    { y: 0.2, rotY: Math.PI / 2 + 0.12, x: 0.1, z: 0, material: charMaterial },
  ];
  logs.forEach((spec) => {
    const log = new THREE.Mesh(logGeometry, spec.material);
    log.position.set(spec.x, spec.y, spec.z);
    // CylinderGeometry points along +Y. Lay it onto +X, then yaw that around world up.
    // q = yaw * lay, so a local +Y sample becomes a horizontal log.
    const lay = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spec.rotY);
    log.quaternion.copy(yaw).multiply(lay);
    log.castShadow = true;
    log.receiveShadow = true;
    group.add(log);
  });

  const coalMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a18, toneMapped: false });
  for (let i = 0; i < 5; i += 1) {
    const coal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), coalMaterial);
    const angle = (i / 5) * Math.PI * 2;
    coal.position.set(Math.cos(angle) * 0.08, 0.14, Math.sin(angle) * 0.08);
    coal.scale.y = 0.45;
    group.add(coal);
  }

  const flames: Flame[] = [];
  FLAMES.forEach((spec, index) => {
    const phase = index * 1.7 + 0.4;
    const material = flameMaterial(phase, spec.height, spec.opacity);
    const mesh = new THREE.Mesh(flameGeometry(spec.radius, spec.height, spec.base, spec.tip), material);
    mesh.position.set(spec.x, 0.12, spec.z);
    // After the star dome (order 16). The dome does not write depth, so a lower
    // order let the night sky paint across the tall tips.
    mesh.renderOrder = 18;
    group.add(mesh);
    flames.push({ mesh, material, phase });
  });

  const embers: Ember[] = [];
  const emberMaterial = new THREE.MeshBasicMaterial({
    color: 0xffb15a,
    transparent: true,
    opacity: 0.9,
    toneMapped: false,
    depthWrite: false,
  });
  const emberGeometry = new THREE.SphereGeometry(0.02, 5, 4);
  for (let i = 0; i < 14; i += 1) {
    const mesh = new THREE.Mesh(emberGeometry, emberMaterial.clone());
    const angle = (i / 14) * Math.PI * 2;
    const radius = 0.04 + (i % 5) * 0.018;
    mesh.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
    mesh.renderOrder = 18;
    group.add(mesh);
    embers.push({
      mesh,
      baseX: mesh.position.x,
      baseZ: mesh.position.z,
      phase: i * 0.37,
      speed: 0.35 + (i % 4) * 0.12,
    });
  }

  const glowMap = glowTexture();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowMap,
      color: 0xff7a3c,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.position.set(0, 0.48, 0);
  glow.scale.set(1.15, 1.45, 1);
  glow.renderOrder = 18;
  group.add(glow);

  const light = new THREE.PointLight(0xff7a3a, 3.1, 6.5, 2);
  light.position.set(0, 0.5, 0);
  light.castShadow = false;
  group.add(light);

  let lightScale = 1;
  // First feed records the winter starting scale (the caller sets 1.5). Later feeds stop at 4× that.
  let baseScale = -1;
  let atMaximum = false;
  const grow = () => {
    if (baseScale < 0) baseScale = group.scale.x || 1;
    const current = group.scale.x || 1;
    const cap = baseScale * 4;
    if (current >= cap - 1e-4) {
      atMaximum = true;
      return;
    }
    const factor = Math.min(current * 1.5, cap) / current;
    group.scale.multiplyScalar(factor);
    lightScale *= factor;
    light.distance *= factor;
    if (group.scale.x >= cap - 1e-4) atMaximum = true;
  };

  const update = (seconds: number) => {
    for (let i = 0; i < flames.length; i += 1) {
      const flame = flames[i];
      const flicker =
        0.78 + Math.sin(seconds * 10.5 + flame.phase) * 0.16 + Math.sin(seconds * 23.0 + flame.phase * 1.3) * 0.09;
      flame.mesh.scale.y = flicker;
      flame.mesh.rotation.x = Math.sin(seconds * 3.1 + flame.phase) * 0.2;
      flame.mesh.rotation.z = Math.cos(seconds * 2.6 + flame.phase * 0.8) * 0.18;
      const shader = flame.material.userData.shader as { uniforms: { uTime: { value: number } } } | undefined;
      if (shader) shader.uniforms.uTime.value = seconds;
    }
    for (let i = 0; i < embers.length; i += 1) {
      const ember = embers[i];
      const cycle = 1.15;
      const y = (seconds * ember.speed + ember.phase) % cycle;
      ember.mesh.position.y = 0.16 + y;
      ember.mesh.position.x = ember.baseX + Math.sin(seconds * 3 + ember.phase) * 0.05 * y;
      ember.mesh.position.z = ember.baseZ + Math.cos(seconds * 2.5 + ember.phase) * 0.05 * y;
      (ember.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - y / cycle) * 0.9;
    }
    const pulse = 0.34 + Math.sin(seconds * 9.0) * 0.08;
    (glow.material as THREE.SpriteMaterial).opacity = pulse;
    glow.scale.set(1.05 + Math.sin(seconds * 7.0) * 0.08, 1.35 + Math.sin(seconds * 11.0) * 0.12, 1);
    light.intensity = (2.5 + Math.sin(seconds * 13.0) * 0.7 + Math.sin(seconds * 29.0) * 0.45) * lightScale;
  };

  return {
    group,
    update,
    grow,
    get atMaximum() {
      return atMaximum;
    },
    dispose: () => glowMap.dispose(),
  };
}
