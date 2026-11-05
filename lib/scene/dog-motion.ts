/** Flared base of the trunk, in world units. The puppy's body stays outside this. */
export const TREE_TRUNK_RADIUS = 2.15;

export type DogMotion = {
  x: number;
  z: number;
  /** Which way round the trunk the dog last chose: +1 raises atan2(z, x), -1 lowers it. */
  detourSide: 1 | -1;
};

export type DogStep = {
  moving: boolean;
  blocked: boolean;
  /** Distance walked this step, used to drive the gait. */
  step: number;
  /** Unit direction the dog actually walked in, for facing. */
  headX: number;
  headZ: number;
};

const BASE_SPEED = 3.4;
const REDUCED_MOTION_SPEED = 16;
// Far from the cursor the puppy breaks into a run so it can keep up with a swirl.
const RUN_BOOST = 1.1;

const smoothstep = (value: number, low: number, high: number) => {
  const t = Math.min(1, Math.max(0, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

/**
 * Step (x, z) by (vx, vz) without entering the trunk cylinder.
 * Motion into the bark slides along it instead.
 */
export function moveOutsideTrunk(x: number, z: number, vx: number, vz: number, clearance: number) {
  const radial = Math.hypot(x, z);
  const safe = Math.max(radial, 0.0001);
  const nx = x / safe;
  const nz = z / safe;
  let svx = vx;
  let svz = vz;
  if (radial <= clearance + 0.08) {
    const intoBark = svx * nx + svz * nz;
    if (intoBark < 0) {
      svx -= nx * intoBark;
      svz -= nz * intoBark;
    }
  }
  let nextX = x + svx;
  let nextZ = z + svz;
  const nextRadial = Math.hypot(nextX, nextZ);
  const blocked = nextRadial < clearance;
  if (blocked) {
    const push = clearance / Math.max(nextRadial, 0.0001);
    nextX *= push;
    nextZ *= push;
  }
  return { x: nextX, z: nextZ, blocked };
}

/**
 * Direction to walk towards (tx, tz). If the straight line would cut through the
 * trunk, aim for the tangent point on the keep-out circle on the shorter side,
 * so the dog walks round the tree instead of stalling against the bark.
 */
function headingAroundTrunk(motion: DogMotion, tx: number, tz: number, clearance: number) {
  const px = motion.x;
  const pz = motion.z;
  const dx = tx - px;
  const dz = tz - pz;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length;
  const uz = dz / length;

  // Walking away from the trunk can never hit it.
  if (px * ux + pz * uz >= 0) return { x: ux, z: uz };

  const along = Math.min(length, -(px * ux + pz * uz));
  const closest = Math.hypot(px + ux * along, pz + uz * along);
  const margin = clearance * 1.04;
  if (closest >= margin) return { x: ux, z: uz };

  const radius = Math.hypot(px, pz);
  const cross = px * tz - pz * tx;
  if (Math.abs(cross) > 0.12 * radius * Math.hypot(tx, tz)) motion.detourSide = cross > 0 ? 1 : -1;
  const side = motion.detourSide;

  if (radius <= margin * 1.001) {
    // On the keep-out circle already: walk along it.
    return { x: (-pz / (radius || 1)) * side, z: (px / (radius || 1)) * side };
  }
  const angle = Math.atan2(pz, px) + side * Math.acos(Math.min(1, margin / radius));
  const hx = margin * Math.cos(angle) - px;
  const hz = margin * Math.sin(angle) - pz;
  const hl = Math.hypot(hx, hz) || 1;
  return { x: hx / hl, z: hz / hl };
}

/** Advances the dog towards (tx, tz) by one frame of `dt` seconds. */
export function stepDog(
  motion: DogMotion,
  tx: number,
  tz: number,
  dt: number,
  clearance: number,
  reduceMotion = false,
): DogStep {
  const dx = tx - motion.x;
  const dz = tz - motion.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.08) return { moving: false, blocked: false, step: 0, headX: 0, headZ: 0 };

  const speed = reduceMotion
    ? REDUCED_MOTION_SPEED
    : BASE_SPEED * (1 + RUN_BOOST * smoothstep(distance, 1.5, 7));
  const step = Math.min(speed * dt, distance);
  const heading = headingAroundTrunk(motion, tx, tz, clearance);
  const moved = moveOutsideTrunk(motion.x, motion.z, heading.x * step, heading.z * step, clearance);
  motion.x = moved.x;
  motion.z = moved.z;
  return { moving: true, blocked: moved.blocked, step, headX: heading.x, headZ: heading.z };
}
