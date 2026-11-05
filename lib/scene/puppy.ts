import * as THREE from "three";

export type Puppy = {
  dog: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  ears: THREE.Group[];
  tongue: THREE.Mesh;
  tail: THREE.Group;
  legs: THREE.Group[];
  /** Collision radius around the dog's centre, used to keep it off the trunk. */
  radius: number;
};

type Vec3 = [number, number, number];

/** Depth of an ellipsoid's front surface at (x, y), for sticking face lines onto it. */
function surfaceZ(radii: Vec3, center: Vec3, x: number, y: number) {
  const nx = (x - center[0]) / radii[0];
  const ny = (y - center[1]) / radii[1];
  return center[2] + radii[2] * Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
}

/**
 * A chibi golden puppy drawn in the monk's language: a big round head, closed
 * happy-arc eyes, blush cheeks and a warm flat palette.
 * Nose points along local +Z, which is the heading `rotation.y = atan2(dx, dz)` uses.
 * Feet sit on y = 0. Legs are ordered front-left, front-right, rear-left, rear-right.
 * The tail pivot is at the rump.
 */
export function createPuppy(): Puppy {
  const dog = new THREE.Group();
  const body = new THREE.Group();
  dog.add(body);

  const warm = { emissive: 0x4a2112, emissiveIntensity: 0.1 };
  const coat = new THREE.MeshStandardMaterial({ color: 0xe0a042, roughness: 0.9, ...warm });
  const coatLight = new THREE.MeshStandardMaterial({ color: 0xebb85c, roughness: 0.9, ...warm });
  const ear = new THREE.MeshStandardMaterial({ color: 0xc27f30, roughness: 0.92, ...warm });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf7e2b8, roughness: 0.88, ...warm });
  const scarf = new THREE.MeshStandardMaterial({ color: 0xb85c28, roughness: 0.94, ...warm });
  const line = new THREE.MeshStandardMaterial({ color: 0x42291f, roughness: 1 });
  const blush = new THREE.MeshStandardMaterial({ color: 0xe59a84, roughness: 1 });
  const tonguePink = new THREE.MeshStandardMaterial({ color: 0xe2808a, roughness: 0.8 });

  const sphere = new THREE.SphereGeometry(1, 32, 20);

  const add = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: Vec3,
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.rotation.set(...rotation);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Torso: a plump bean with a cream bib, kept low and round.
  add(body, sphere, coat, [0, 0.47, -0.14], [0.37, 0.31, 0.42]);
  add(body, sphere, coat, [0, 0.46, -0.38], [0.33, 0.28, 0.26]);
  add(body, sphere, coatLight, [0, 0.68, -0.16], [0.25, 0.1, 0.32]);
  add(body, sphere, cream, [0, 0.38, 0.15], [0.24, 0.22, 0.17]);

  // A scarf in the monk's robe colour ties the pair together.
  add(body, new THREE.TorusGeometry(0.27, 0.05, 10, 32), scarf, [0, 0.55, 0.18], [1, 1, 1], [Math.PI / 2 - 0.45, 0, 0]);

  const head = new THREE.Group();
  head.position.set(0, 0.86, 0.3);
  body.add(head);

  const headRadii: Vec3 = [0.43, 0.38, 0.39];
  const muzzleCenter: Vec3 = [0, -0.1, 0.3];
  const muzzleRadii: Vec3 = [0.19, 0.14, 0.15];
  const headZ = (x: number, y: number) => surfaceZ(headRadii, [0, 0, 0], x, y);
  const muzzleZ = (x: number, y: number) => surfaceZ(muzzleRadii, muzzleCenter, x, y);

  const faceLine = (points: [number, number][], zOf: (x: number, y: number) => number, radius: number) => {
    const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, zOf(x, y) + 0.008)));
    add(head, new THREE.TubeGeometry(curve, 24, radius, 6, false), line, [0, 0, 0]).receiveShadow = false;
  };

  add(head, sphere, coat, [0, 0, 0], headRadii);
  add(head, sphere, cream, muzzleCenter, muzzleRadii);
  add(head, sphere, line, [0, -0.045, 0.44], [0.07, 0.05, 0.045]);

  // Closed happy-arc eyes, drawn as lines like the monk's.
  for (const side of [-1, 1]) {
    const ex = side * 0.185;
    const eyePoints: [number, number][] = [];
    for (let i = 0; i <= 8; i += 1) {
      const u = i / 4 - 1;
      eyePoints.push([ex + u * 0.078, 0.06 + (1 - u * u) * 0.045]);
    }
    faceLine(eyePoints, headZ, 0.017);

    add(head, sphere, cream, [side * 0.18, 0.2, headZ(side * 0.18, 0.2) - 0.005], [0.05, 0.032, 0.02]);
    add(
      head,
      sphere,
      blush,
      [side * 0.295, -0.06, headZ(side * 0.295, -0.06) - 0.004],
      [0.068, 0.042, 0.018],
      [0, side * 0.85, 0],
    );
  }

  // A short stem and two small arcs make the classic cartoon mouth.
  faceLine(
    [
      [0, -0.085],
      [0, -0.105],
      [0, -0.125],
    ],
    muzzleZ,
    0.012,
  );
  for (const side of [-1, 1]) {
    const mouthPoints: [number, number][] = [];
    for (let i = 0; i <= 6; i += 1) {
      const s = i / 6;
      mouthPoints.push([side * s * 0.09, -0.125 + 0.005 * s - Math.sin(Math.PI * s) * 0.04]);
    }
    faceLine(mouthPoints, muzzleZ, 0.012);
  }

  const tongue = add(head, sphere, tonguePink, [0, -0.2, 0.41], [0.045, 0.012, 0.06], [0.5, 0, 0]);
  tongue.scale.setScalar(0.0001);

  const ears: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.31, 0.2, -0.03);
    pivot.rotation.set(-0.12, 0, side * 0.42);
    head.add(pivot);
    add(pivot, sphere, ear, [side * 0.035, -0.15, 0], [0.09, 0.25, 0.17]);
    ears.push(pivot);
  }

  // A curled, fluffy tail built from a chain of spheres that swell towards the tip.
  const tail = new THREE.Group();
  tail.position.set(0, 0.56, -0.56);
  body.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.1, -0.12),
    new THREE.Vector3(0, 0.28, -0.18),
    new THREE.Vector3(0, 0.42, -0.08),
    new THREE.Vector3(0, 0.44, 0.05),
  ]);
  const tailSteps = 18;
  for (let i = 0; i <= tailSteps; i += 1) {
    const t = i / tailSteps;
    const point = tailCurve.getPointAt(t);
    const radius = 0.07 + t * 0.05;
    const material = i >= tailSteps - 2 ? cream : i >= tailSteps - 6 ? coatLight : coat;
    add(tail, sphere, material, [point.x, point.y, point.z], [radius, radius, radius]);
  }

  const legs: THREE.Group[] = [];
  const legSpots: [number, number][] = [
    [-0.17, 0.22],
    [0.17, 0.22],
    [-0.2, -0.4],
    [0.2, -0.4],
  ];
  const legGeometry = new THREE.CapsuleGeometry(0.08, 0.1, 4, 12);
  legSpots.forEach(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.28, z);
    body.add(pivot);
    add(pivot, legGeometry, coat, [0, -0.1, 0]);
    add(pivot, sphere, cream, [0, -0.215, 0.03], [0.1, 0.065, 0.13]);
    legs.push(pivot);
  });

  const scale = 1.2;
  dog.scale.setScalar(scale);
  // Same collision volume as before, so the trunk clearance and walking feel are unchanged.
  return { dog, body, head, ears, tongue, tail, legs, radius: 1.05 * scale };
}
