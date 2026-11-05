export const MIN_VIEW_DISTANCE = 2.2;
export const MAX_VIEW_DISTANCE = 58;
// Never dolly closer to the anchored point than this, so the camera cannot end up inside it.
const MIN_ANCHOR_GAP = 1.2;
const TARGET_BOUNDS = { x: [-45, 45], y: [-1, 34], z: [-45, 45] } as const;

export type Vec3 = { x: number; y: number; z: number };

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Converts a wheel event into a zoom factor: below 1 zooms in, above 1 zooms out. */
export function wheelToFactor(deltaY: number, deltaMode: number): number {
  const pixels = deltaMode === 1 ? deltaY * 33 : deltaMode === 2 ? deltaY * 400 : deltaY;
  return Math.exp(clamp(pixels, -250, 250) * 0.0011);
}

/**
 * Scales the camera distance and the orbit target about `anchor`, which moves the
 * camera along the ray to that point and keeps it under the cursor at every step.
 * `camera` is the camera position of the pose being zoomed.
 */
export function zoomAboutAnchor(distance: number, target: Vec3, camera: Vec3, anchor: Vec3, factor: number) {
  const gap = Math.hypot(camera.x - anchor.x, camera.y - anchor.y, camera.z - anchor.z);
  const closest = Math.max(MIN_VIEW_DISTANCE / distance, MIN_ANCHOR_GAP / Math.max(gap, 1e-6));
  const farthest = MAX_VIEW_DISTANCE / distance;
  // A limit that is already exceeded blocks that direction without reversing it.
  const k = factor < 1 ? Math.max(factor, Math.min(closest, 1)) : Math.min(factor, Math.max(farthest, 1));

  return {
    k,
    distance: distance * k,
    target: {
      x: clamp(anchor.x + (target.x - anchor.x) * k, ...TARGET_BOUNDS.x),
      y: clamp(anchor.y + (target.y - anchor.y) * k, ...TARGET_BOUNDS.y),
      z: clamp(anchor.z + (target.z - anchor.z) * k, ...TARGET_BOUNDS.z),
    },
  };
}
