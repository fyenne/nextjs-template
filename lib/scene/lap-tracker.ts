const FULL_TURN = Math.PI * 2;

/**
 * Turns around the tree that unlock the next stage.
 */
export const LAPS_TO_UNLOCK = 3;

export type LapDirection = "cw" | "ccw";

export type LapState = {
  /** Net turns in the current direction, always >= 0. */
  laps: number;
  direction: LapDirection | null;
  completed: boolean;
  /** True only on the update that finishes the final lap. */
  justCompleted: boolean;
  /** Set when a new highest whole lap was reached on this update. */
  newFullLap: number | null;
};

/**
 * Counts how many times something circles the origin (the tree trunk).
 *
 * It sums the signed angle swept around the origin, so reversing direction
 * unwinds progress. Positive angle runs from +x towards +z, which is clockwise
 * when the scene is viewed from above.
 */
export class LapTracker {
  private previousAngle: number | null = null;
  private net = 0;
  private bestFullLap = 0;
  private done = false;

  constructor(private readonly target = LAPS_TO_UNLOCK) {}

  get completed() {
    return this.done;
  }

  update(x: number, z: number): LapState {
    let justCompleted = false;
    let newFullLap: number | null = null;

    if (!this.done && Math.hypot(x, z) > 1e-3) {
      const angle = Math.atan2(z, x);
      if (this.previousAngle !== null) {
        let delta = angle - this.previousAngle;
        if (delta > Math.PI) delta -= FULL_TURN;
        else if (delta < -Math.PI) delta += FULL_TURN;
        // A near half-turn jump in one frame is a teleport, not walking.
        if (Math.abs(delta) < Math.PI * 0.75) this.net += delta;
      }
      this.previousAngle = angle;

      const fullLaps = Math.min(this.target, Math.floor(Math.abs(this.net) / FULL_TURN));
      if (fullLaps > this.bestFullLap) {
        this.bestFullLap = fullLaps;
        newFullLap = fullLaps;
      }
      if (Math.abs(this.net) >= this.target * FULL_TURN) {
        this.done = true;
        justCompleted = true;
      }
    }

    return {
      laps: Math.min(this.target, Math.abs(this.net) / FULL_TURN),
      direction: this.net === 0 ? null : this.net > 0 ? "cw" : "ccw",
      completed: this.done,
      justCompleted,
      newFullLap,
    };
  }
}
