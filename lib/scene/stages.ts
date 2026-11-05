import { LAPS_TO_UNLOCK, LapTracker, type LapState } from "./lap-tracker";

/** The scene always starts green and moves on one stage per three laps round the tree. */
export const STAGES = ["green", "autumn", "winter"] as const;
export type Stage = (typeof STAGES)[number];

export type StageUpdate = {
  stage: Stage;
  /** The stage that follows this one, or null once winter is reached. */
  next: Stage | null;
  /** Progress towards the next stage. Stays empty in the final stage. */
  lap: LapState;
  /** Set only on the update that finished the laps and moved to a new stage. */
  advancedTo: Stage | null;
};

const IDLE: LapState = { laps: 0, direction: null, completed: false, justCompleted: false, newFullLap: null };

export class SceneStages {
  private index = 0;
  private tracker = new LapTracker();

  constructor(private readonly lapsPerStage = LAPS_TO_UNLOCK) {}

  get stage(): Stage {
    return STAGES[this.index];
  }

  get next(): Stage | null {
    return STAGES[this.index + 1] ?? null;
  }

  /** Jumps straight to a stage without counting laps, for previews. */
  jumpTo(stage: Stage) {
    this.index = STAGES.indexOf(stage);
    this.tracker = new LapTracker(this.lapsPerStage);
  }

  update(x: number, z: number): StageUpdate {
    if (this.next === null) return { stage: this.stage, next: null, lap: IDLE, advancedTo: null };

    const lap = this.tracker.update(x, z);
    let advancedTo: Stage | null = null;
    if (lap.justCompleted) {
      this.index += 1;
      // Prime the fresh counter with where the dog is now, so no part of the next lap is lost.
      this.tracker = new LapTracker(this.lapsPerStage);
      this.tracker.update(x, z);
      advancedTo = this.stage;
    }
    return { stage: this.stage, next: this.next, lap, advancedTo };
  }
}
